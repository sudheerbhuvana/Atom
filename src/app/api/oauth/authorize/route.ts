import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { validateAuthorizeRequest, generateAuthorizationCode, type AuthorizeParams } from '@/lib/oauth/provider';
import { getUserConsent } from '@/lib/db-oauth';
import { getConfig } from '@/lib/config';
import { redirect } from 'next/navigation';

/**
 * OAuth2 Authorization Endpoint
 * GET /api/oauth/authorize
 * 
 * Handles authorization requests from OAuth clients.
 * Validates the request and either shows consent screen or auto-approves if consent exists.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    // Parse authorization parameters
    const params: AuthorizeParams = {
        response_type: searchParams.get('response_type') || '',
        client_id: searchParams.get('client_id') || '',
        redirect_uri: searchParams.get('redirect_uri') || '',
        scope: searchParams.get('scope') || undefined,
        state: searchParams.get('state') || undefined,
        code_challenge: searchParams.get('code_challenge') || undefined,
        code_challenge_method: (searchParams.get('code_challenge_method') as 'S256' | 'plain') || undefined,
        nonce: searchParams.get('nonce') || undefined, // OIDC nonce for replay protection
    };

    // Validate authorization request
    const validation = validateAuthorizeRequest(params);
    if (!validation.success) {
        // Return error to redirect URI if possible
        if (params.redirect_uri) {
            const errorUrl = new URL(params.redirect_uri);
            errorUrl.searchParams.set('error', validation.error!);
            if (validation.error_description) {
                errorUrl.searchParams.set('error_description', validation.error_description);
            }
            if (params.state) {
                errorUrl.searchParams.set('state', params.state);
            }
            return NextResponse.redirect(errorUrl.toString());
        }

        // Otherwise return JSON error
        return NextResponse.json(
            {
                error: validation.error,
                error_description: validation.error_description,
            },
            { status: 400 }
        );
    }

    // Dynamically determine base URL from request headers to avoid 0.0.0.0 redirects
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
        // Redirect to login with return URL
        const loginUrl = new URL('/login', baseUrl);
        // Construct return URL using the dynamic base URL to avoid 0.0.0.0
        const returnTo = new URL(request.nextUrl.pathname + request.nextUrl.search, baseUrl);
        loginUrl.searchParams.set('returnTo', returnTo.toString());
        return NextResponse.redirect(loginUrl.toString());
    }

    // Access Control Check
    const config = await getConfig();
    if (config) {
        const service = config.services.find(s => s.id === params.client_id);
        if (service && service.tags && service.tags.length > 0) {
            const userTags = user.tags || [];
            // Check if user has "all" tag or matches any service tag
            const hasAccess = userTags.includes('all') || service.tags.some(t => userTags.includes(t));

            if (!hasAccess) {
                // Deny access
                if (params.redirect_uri) {
                    const errorUrl = new URL(params.redirect_uri);
                    errorUrl.searchParams.set('error', 'access_denied');
                    errorUrl.searchParams.set('error_description', 'User does not have the required tags to access this application');
                    if (params.state) {
                        errorUrl.searchParams.set('state', params.state);
                    }
                    return NextResponse.redirect(errorUrl.toString());
                } else {
                    return NextResponse.json(
                        { error: 'access_denied', error_description: 'User does not have the required tags to access this application' },
                        { status: 403 }
                    );
                }
            }
        }
    }

    // Check if user has already consented to this client
    const existingConsent = getUserConsent(user.id, params.client_id);

    // If consent exists and covers all requested scopes, auto-approve
    if (existingConsent) {
        const requestedScopes = validation.scopes!;
        const hasAllScopes = requestedScopes.every(scope =>
            existingConsent.scopes.includes(scope)
        );

        if (hasAllScopes) {
            // Auto-approve: generate authorization code and redirect
            const code = generateAuthorizationCode(
                params.client_id,
                user.id,
                params.redirect_uri,
                requestedScopes,
                params.code_challenge,
                params.code_challenge_method,
                params.nonce
            );

            const redirectUrl = new URL(params.redirect_uri);
            redirectUrl.searchParams.set('code', code);
            if (params.state) {
                redirectUrl.searchParams.set('state', params.state);
            }

            return NextResponse.redirect(redirectUrl.toString());
        }
    }

    // Show consent screen
    const consentUrl = new URL('/oauth/consent', baseUrl);
    consentUrl.searchParams.set('client_id', params.client_id);
    consentUrl.searchParams.set('redirect_uri', params.redirect_uri);
    consentUrl.searchParams.set('scope', params.scope || 'openid');
    if (params.state) {
        consentUrl.searchParams.set('state', params.state);
    }
    if (params.code_challenge) {
        consentUrl.searchParams.set('code_challenge', params.code_challenge);
    }
    if (params.code_challenge_method) {
        consentUrl.searchParams.set('code_challenge_method', params.code_challenge_method);
    }

    return NextResponse.redirect(consentUrl.toString());
}

/**
 * OAuth2 Authorization Endpoint - Consent Submission
 * POST /api/oauth/authorize
 * 
 * Handles user consent (approve/deny) for authorization requests.
 */
export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method,
        approved
    } = body;

    // If user denied, redirect with error
    if (!approved) {
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('error', 'access_denied');
        redirectUrl.searchParams.set('error_description', 'User denied the authorization request');
        if (state) {
            redirectUrl.searchParams.set('state', state);
        }
        return NextResponse.json({ redirect_uri: redirectUrl.toString() });
    }

    // User approved: generate authorization code
    const scopes = scope.split(' ').filter((s: string) => s.length > 0);
    const code = generateAuthorizationCode(
        client_id,
        user.id,
        redirect_uri,
        scopes,
        code_challenge,
        code_challenge_method,
        body.nonce
    );

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
        redirectUrl.searchParams.set('state', state);
    }

    return NextResponse.json({ redirect_uri: redirectUrl.toString() });
}
