import { NextRequest, NextResponse } from 'next/server';
import { getOIDCConfiguration } from '../../../../lib/oidc/discovery';

/**
 * OIDC Discovery Endpoint
 * GET /.well-known/openid-configuration
 * 
 * Returns OpenID Connect Discovery metadata
 */
export async function GET(request: NextRequest) {
    try {
        // Dynamically determine base URL from request headers
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const baseUrl = `${protocol}://${host}`;

        const config = getOIDCConfiguration(baseUrl);

        return NextResponse.json(config, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });
    } catch (error) {
        console.error('OIDC Discovery error:', error);
        return NextResponse.json(
            { error: 'server_error' },
            { status: 500 }
        );
    }
}
