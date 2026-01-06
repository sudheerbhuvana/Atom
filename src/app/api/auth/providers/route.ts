import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
    createAuthProvider,
    getAllAuthProviders,
    listEnabledAuthProviders,
    AuthProvider
} from '@/lib/auth-providers';
import { getOIDCConfiguration } from '@/lib/oidc/discovery'; // We might want a real discovery fetcher later

export const dynamic = 'force-dynamic';

// Public endpoint to list enabled providers (for login page)
// Or authenticated endpoint to list all (for settings)?
// Let's allow public listing of ENABLED providers.
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        const searchParams = request.nextUrl.searchParams;
        const all = searchParams.get('all') === 'true';

        if (all) {
            // Only authenticated users can see ALL providers (including disabled)
            if (!user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            const providers = getAllAuthProviders();
            // Scrub secrets
            const safeProviders = providers.map(p => ({ ...p, client_secret: undefined }));
            return NextResponse.json(safeProviders);
        } else {
            // Public list for Login Page
            const providers = listEnabledAuthProviders();
            // Ideally we only need name and slug and auth url? 
            // We need slug to construct /api/auth/[slug]/login
            const publicProviders = providers.map(p => ({
                name: p.name,
                slug: p.slug
            }));
            return NextResponse.json(publicProviders);
        }
    } catch (error) {
        console.error('Failed to list providers:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Protected endpoint to create a provider
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Basic validation
        if (!body.name || !body.slug || !body.issuer || !body.client_id || !body.client_secret) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Attempt to auto-discover endpoints if not provided
        // For now, we'll just respect what's passed or default to none (which means we need to discover later or fail)
        // A better UX would be to fetch discovery URL here and populate.

        const newProvider = createAuthProvider({
            name: body.name,
            slug: body.slug,
            issuer: body.issuer,
            client_id: body.client_id,
            client_secret: body.client_secret,
            authorization_endpoint: body.authorization_endpoint,
            token_endpoint: body.token_endpoint,
            userinfo_endpoint: body.userinfo_endpoint,
            jwks_uri: body.jwks_uri,
            scopes: body.scopes,
            enabled: body.enabled !== false // Default to true
        });

        return NextResponse.json({
            success: true,
            provider: { ...newProvider, client_secret: undefined }
        });

    } catch (error) {
        console.error('Failed to create provider:', error);
        // SQLite unique constraint check could be done here
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Protected endpoint to delete a provider
export async function DELETE(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { slug } = await request.json();

        if (!slug) {
            return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
        }

        const { deleteAuthProvider } = await import('@/lib/auth-providers');
        const success = deleteAuthProvider(slug);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

    } catch (error) {
        console.error('Failed to delete provider:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Protected endpoint to update a provider
export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        if (!body.slug) {
            return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
        }

        const { updateAuthProvider } = await import('@/lib/auth-providers');
        const success = updateAuthProvider(body.slug, {
            name: body.name,
            issuer: body.issuer,
            client_id: body.client_id,
            client_secret: body.client_secret,
            authorization_endpoint: body.authorization_endpoint,
            token_endpoint: body.token_endpoint,
            userinfo_endpoint: body.userinfo_endpoint,
            jwks_uri: body.jwks_uri,
            scopes: body.scopes,
            enabled: body.enabled
        });

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Provider not found or update failed' }, { status: 404 });
        }

    } catch (error) {
        console.error('Failed to update provider:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
