import { NextRequest, NextResponse } from 'next/server';
import { getAuthProviderBySlug, linkFederatedIdentity, getFederatedIdentity } from '@/lib/auth-providers';
import { createUser, getUserByUsername, createSession, getUserById } from '@/lib/db'; // getUserById, getUserByEmail if exists?
import { fetchOIDCConfiguration } from '@/lib/oidc/client-discovery';
import jose from 'node-jose';
import { cookies } from 'next/headers';
import { getSafeRedirectUrl } from '@/lib/redirect-utils';

// We need a way to find user by email from db.ts
// Assuming query `SELECT * FROM users WHERE email = ?` exists or I add it.
import db from '@/lib/db';

function getUserByEmail(email: string) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as any;
}

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    const { provider: slug } = await params;

    // 1. Validate State
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code || !state) {
        return NextResponse.redirect(new URL('/login?error=Missing+code+or+state', request.url));
    }

    const cookieStore = await cookies();
    const stateCookie = cookieStore.get(`oauth_state_${slug}`);

    if (!stateCookie) {
        return NextResponse.redirect(new URL('/login?error=State+cookie+missing', request.url));
    }

    let savedState: { state: string; nonce: string; provider: string; returnTo?: string };
    try {
        savedState = JSON.parse(stateCookie.value);
    } catch {
        return NextResponse.redirect(new URL('/login?error=Invalid+state+cookie', request.url));
    }

    if (savedState.state !== state || savedState.provider !== slug) {
        return NextResponse.redirect(new URL('/login?error=State+mismatch', request.url));
    }

    // Clear state cookie
    cookieStore.delete(`oauth_state_${slug}`);

    // 2. Get Provider Config
    const provider = getAuthProviderBySlug(slug);
    if (!provider || !provider.enabled) {
        return NextResponse.redirect(new URL('/login?error=Provider+disabled', request.url));
    }

    try {
        // 3. Discover Endpoints if needed
        let tokenEndpoint = provider.token_endpoint;
        let jwksUri = provider.jwks_uri;
        let userInfoEndpoint = provider.userinfo_endpoint;

        // Only try discovery if we are missing critical endpoints AND we have an issuer that looks like a URL
        if ((!tokenEndpoint || !jwksUri) && provider.issuer.startsWith('http')) {
            try {
                const config = await fetchOIDCConfiguration(provider.issuer);
                tokenEndpoint = config.token_endpoint || tokenEndpoint;
                jwksUri = config.jwks_uri || jwksUri;
                userInfoEndpoint = config.userinfo_endpoint || userInfoEndpoint;
            } catch (e) {
                console.warn('Discovery failed, proceeding with stored config:', e);
            }
        }

        if (!tokenEndpoint) {
            throw new Error('Missing token endpoint');
        }

        // 4. Exchange Code
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const redirectUri = `${protocol}://${host}/api/auth/${slug}/callback`;

        // GitHub specifically requires 'Accept: application/json'
        const tokenHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        };

        const tokenParams = new URLSearchParams();
        tokenParams.append('client_id', provider.client_id);
        tokenParams.append('client_secret', provider.client_secret);
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', redirectUri);
        // Some providers need grant_type, GitHub doesn't strictly enforce but it's spec compliant
        tokenParams.append('grant_type', 'authorization_code');

        const tokenRes = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: tokenHeaders,
            body: tokenParams
        });

        if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            console.error('Token exchange failed:', errBody);
            throw new Error('Failed to exchange token');
        }

        const tokens = await tokenRes.json();

        let subject: string | null = null;
        let email: string | null = null;
        let username: string | null = null;

        // 5. Try OIDC (ID Token) first
        if (tokens.id_token && jwksUri) {
            // ... Existing OIDC Verification Logic ...
            const jwksRes = await fetch(jwksUri, { next: { revalidate: 3600 } });
            const jwks = await jwksRes.json();
            const keystore = await jose.JWK.asKeyStore(jwks);
            const result = await jose.JWS.createVerify(keystore).verify(tokens.id_token);
            const payload = JSON.parse(result.payload.toString());

            // Validate Issuer/Audience if possible
            if (!payload.iss.startsWith(provider.issuer) && !provider.issuer.startsWith(payload.iss)) {
                console.warn(`Issuer mismatch warning: ${payload.iss} vs ${provider.issuer}`);
            }

            subject = payload.sub;
            email = payload.email;
            username = payload.preferred_username || payload.name;
        }

        // 6. Fallback to UserInfo Endpoint (OAuth2)
        if (!subject && userInfoEndpoint) {
            const userRes = await fetch(userInfoEndpoint, {
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Accept': 'application/json'
                }
            });

            if (userRes.ok) {
                const profile = await userRes.json();
                // Map common fields
                subject = String(profile.id || profile.sub); // GitHub uses 'id' (number), OIDC uses 'sub'
                email = profile.email;
                username = profile.login || profile.preferred_username || profile.name;

                // Handle GitHub private emails
                if (!email && slug === 'github' && tokens.access_token) {
                    try {
                        const emailRes = await fetch('https://api.github.com/user/emails', {
                            headers: {
                                'Authorization': `Bearer ${tokens.access_token}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (emailRes.ok) {
                            const emails = await emailRes.json();
                            // Find primary verified email
                            const primaryEmail = emails.find((e: any) => e.primary && e.verified);
                            if (primaryEmail) {
                                email = primaryEmail.email;
                            }
                        }
                    } catch (e) {
                        console.error('Failed to fetch user emails from GitHub:', e);
                    }
                }
            }
        }

        if (!subject) {
            throw new Error('Could not identify user from ID Token or UserInfo');
        }

        // 7. User Linking / Creation
        let federatedIdentity = getFederatedIdentity(slug, subject);
        let userId: number;

        if (federatedIdentity) {
            userId = federatedIdentity.user_id;
        } else {
            let existingUser = email ? getUserByEmail(email) : null;

            if (existingUser) {
                userId = existingUser.id;
            } else {
                const finalUsername = username || email?.split('@')[0] || `user_${subject.substring(0, 8)}`;
                const dummyHash = '$2a$10$federated_dummy_hash_auth_' + crypto.randomUUID();

                try {
                    const newUser = createUser(finalUsername, dummyHash, email || undefined);
                    userId = newUser.id;
                } catch (e) {
                    const uniqueName = `${finalUsername}_${crypto.randomUUID().substring(0, 4)}`;
                    const newUser = createUser(uniqueName, dummyHash, email || undefined);
                    userId = newUser.id;
                }
            }
            linkFederatedIdentity(userId, slug, subject, email || undefined);
        }

        // Create session
        const session = createSession(userId);

        // Build redirect URL with validation
        const baseUrl = request.nextUrl.origin;
        const returnTo = savedState.returnTo;

        // Validate and use returnTo if provided, otherwise default to root
        const redirectUrl = getSafeRedirectUrl(returnTo, '/', baseUrl);

        // Create response with redirect
        const response = NextResponse.redirect(new URL(redirectUrl, baseUrl));

        // Set session cookie
        response.cookies.set('atom_session', session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        return response;

    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(new URL('/login?error=Authentication+failed', request.url));
    }
}
