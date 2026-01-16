import { NextRequest, NextResponse } from 'next/server';
import { getAuthProviderBySlug, linkFederatedIdentity, getFederatedIdentity } from '@/lib/auth-providers';
import { createUser, getUserByUsername, createSession, getUserById } from '@/lib/db'; // getUserById, getUserByEmail if exists?
import { fetchOIDCConfiguration } from '@/lib/oidc/client-discovery';
import jose from 'node-jose';
import { cookies } from 'next/headers';
import { getSafeRedirectUrl } from '@/lib/redirect-utils';

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


    const provider = getAuthProviderBySlug(slug);
    if (!provider || !provider.enabled) {
        return NextResponse.redirect(new URL('/login?error=Provider+disabled', request.url));
    }

    try {
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

        // Construct callback redirect_uri (must match what was sent to provider)
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
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


        const matchField = provider.user_match_field || 'email';
        const autoRegister = provider.auto_register !== false; // Default to true

        let federatedIdentity = getFederatedIdentity(slug, subject);
        let userId: number | undefined;

        if (federatedIdentity) {
            // Already linked
            userId = federatedIdentity.user_id;
        } else {
            // Try to match by configured field
            let existingUser: any = null;

            if (matchField === 'email' && email) {
                existingUser = getUserByEmail(email);
            } else if (matchField === 'username' && username) {
                existingUser = getUserByUsername(username);
            }
            // For 'sub' matching, we only use federated_identities table (checked above)

            if (existingUser) {
                userId = existingUser.id;
            } else if (autoRegister) {
                // Auto-register new user
                const finalUsername = username || email?.split('@')[0] || `user_${subject.substring(0, 8)}`;
                const dummyHash = '$2a$10$federated_dummy_hash_auth_' + crypto.randomUUID();

                try {
                    const newUser = createUser(finalUsername, dummyHash, email || undefined);
                    userId = newUser.id;
                } catch (_e) {
                    // Username collision, add unique suffix
                    const uniqueName = `${finalUsername}_${crypto.randomUUID().substring(0, 4)}`;
                    const newUser = createUser(uniqueName, dummyHash, email || undefined);
                    userId = newUser.id;
                }
            } else {
                // Auto-register is off and no existing user found
                return NextResponse.redirect(
                    new URL(`/login?error=${encodeURIComponent('No account found. Please contact administrator.')}`, request.url)
                );
            }

            // Link the federated identity if we have a userId
            if (userId) {
                linkFederatedIdentity(userId, slug, subject, email || undefined);
            }
        }

        if (!userId) {
            return NextResponse.redirect(
                new URL('/login?error=Authentication+failed', request.url)
            );
        }

        // Create session
        const session = createSession(userId);

        // Build redirect URL with validation
        // Reuse host and protocol from earlier token exchange (already defined at line 89-91)
        const baseUrl = `${protocol}://${host}`;

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
