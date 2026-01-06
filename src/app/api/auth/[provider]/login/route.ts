import { NextRequest, NextResponse } from 'next/server';
import { getAuthProviderBySlug } from '@/lib/auth-providers';
import { fetchOIDCConfiguration } from '@/lib/oidc/client-discovery';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    const { provider: slug } = await params;
    const provider = getAuthProviderBySlug(slug);

    if (!provider || !provider.enabled) {
        return NextResponse.json({ error: 'Provider not found or disabled' }, { status: 404 });
    }

    try {
        let authEndpoint = provider.authorization_endpoint;

        // Auto-discover if missing
        if (!authEndpoint) {
            const config = await fetchOIDCConfiguration(provider.issuer);
            authEndpoint = config.authorization_endpoint;
        }

        // Construct Redirect URI (Callback)
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const redirectUri = `${protocol}://${host}/api/auth/${slug}/callback`;

        // Generate State & Nonce
        const state = crypto.randomUUID();
        const nonce = crypto.randomUUID();

        // Construct Auth URL
        const url = new URL(authEndpoint);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', provider.client_id);
        url.searchParams.set('redirect_uri', redirectUri);
        // Use configured scopes or default to standard OIDC
        url.searchParams.set('scope', provider.scopes || 'openid profile email');
        url.searchParams.set('state', state);
        url.searchParams.set('nonce', nonce);

        // Create response with redirect
        const response = NextResponse.redirect(url.toString());

        // Store state in cookie for validation in callback
        // Expires in 10 minutes
        response.cookies.set('atom_oauth_state', JSON.stringify({ state, nonce, provider: slug }), {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'lax',
            maxAge: 600,
            path: '/api/auth' // Limit scope to auth routes
        });

        return response;

    } catch (error) {
        console.error(`Login init failed for ${slug}:`, error);
        return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 });
    }
}
