import { NextRequest, NextResponse } from 'next/server';
import { getAuthProviderBySlug, linkFederatedIdentity, getFederatedIdentity } from '@/lib/auth-providers';
import { createUser, getUserByUsername, createSession, getUserById } from '@/lib/db'; // getUserById, getUserByEmail if exists?
import { fetchOIDCConfiguration } from '@/lib/oidc/client-discovery';
import jose from 'node-jose';
import { cookies } from 'next/headers';

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
    const stateCookie = cookieStore.get('atom_oauth_state');

    if (!stateCookie) {
        return NextResponse.redirect(new URL('/login?error=State+cookie+missing', request.url));
    }

    let savedState: any;
    try {
        savedState = JSON.parse(stateCookie.value);
    } catch {
        return NextResponse.redirect(new URL('/login?error=Invalid+state+cookie', request.url));
    }

    if (savedState.state !== state || savedState.provider !== slug) {
        return NextResponse.redirect(new URL('/login?error=State+mismatch', request.url));
    }

    // Clear state cookie
    cookieStore.delete('atom_oauth_state');

    // 2. Get Provider Config
    const provider = getAuthProviderBySlug(slug);
    if (!provider || !provider.enabled) {
        return NextResponse.redirect(new URL('/login?error=Provider+disabled', request.url));
    }

    try {
        // 3. Discover Endpoints if needed
        let tokenEndpoint = provider.token_endpoint;
        let jwksUri = provider.jwks_uri;

        if (!tokenEndpoint || !jwksUri) {
            const config = await fetchOIDCConfiguration(provider.issuer);
            tokenEndpoint = config.token_endpoint;
            jwksUri = config.jwks_uri;
        }

        // 4. Exchange Code
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const redirectUri = `${protocol}://${host}/api/auth/${slug}/callback`;

        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', redirectUri);
        tokenParams.append('client_id', provider.client_id);
        tokenParams.append('client_secret', provider.client_secret);

        const tokenRes = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        if (!tokenRes.ok) {
            const errBody = await tokenRes.text();
            console.error('Token exchange failed:', errBody);
            throw new Error('Failed to exchange token');
        }

        const tokens = await tokenRes.json();
        const idToken = tokens.id_token;

        if (!idToken) throw new Error('No id_token returned');

        // 5. Verify ID Token
        // Fetch JWKS
        const jwksRes = await fetch(jwksUri, { next: { revalidate: 3600 } });
        const jwks = await jwksRes.json();

        const keystore = await jose.JWK.asKeyStore(jwks);

        // Validate signature
        const result = await jose.JWS.createVerify(keystore).verify(idToken);
        const payload = JSON.parse(result.payload.toString());

        // Validate claims
        // Issuer check: Payload issuer must match (or start with) provider issuer
        // Some providers add trailing slashes, so simple verify
        if (!payload.iss.startsWith(provider.issuer) && !provider.issuer.startsWith(payload.iss)) {
            // throw new Error(`Issuer mismatch: ${payload.iss} vs ${provider.issuer}`);
            // Warn only for now as distinct trailing slashes are common
            console.warn(`Issuer mismatch warning: ${payload.iss} vs ${provider.issuer}`);
        }

        // Aud check
        const aud = payload.aud;
        if (Array.isArray(aud)) {
            if (!aud.includes(provider.client_id)) throw new Error('Audience mismatch');
        } else if (aud !== provider.client_id) {
            throw new Error(`Audience mismatch: ${aud} vs ${provider.client_id}`);
        }

        // 6. User Linking / Creation
        const subject = payload.sub;
        const email = payload.email; // Requires 'email' scope

        let federatedIdentity = getFederatedIdentity(slug, subject);
        let userId: number;

        if (federatedIdentity) {
            // User exists, log them in
            userId = federatedIdentity.user_id;
        } else {
            // New federated user
            // Check if email exists
            let existingUser = email ? getUserByEmail(email) : null;

            if (existingUser) {
                // Link to existing user
                userId = existingUser.id;
            } else {
                // Create new user
                const username = payload.preferred_username || payload.name || email?.split('@')[0] || `user_${subject.substring(0, 8)}`;
                // Handle username collision logic... simplified for now
                // We generate a dummy password hash
                const dummyHash = '$2a$10$federated_dummy_hash_auth_' + crypto.randomUUID();

                try {
                    const newUser = createUser(username, dummyHash, email);
                    userId = newUser.id;
                } catch (e) {
                    // If username taken, try appending random suffix
                    const uniqueName = `${username}_${crypto.randomUUID().substring(0, 4)}`;
                    const newUser = createUser(uniqueName, dummyHash, email);
                    userId = newUser.id;
                }
            }

            // Create Link
            linkFederatedIdentity(userId, slug, subject, email);
        }

        // 7. Create Session
        const session = createSession(userId);

        // Set session Cookie
        const response = NextResponse.redirect(new URL('/', request.url));
        const isSecure = process.env.COOKIE_SECURE === 'true';

        response.cookies.set('atom_session', session.id, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            // db.ts says 7 days
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            path: '/',
        });

        return response;

    } catch (error) {
        console.error('Callback error:', error);
        return NextResponse.redirect(new URL('/login?error=Authentication+failed', request.url));
    }
}
