import { NextResponse } from 'next/server';

/**
 * OIDC Discovery endpoint (root level)
 * GET /.well-known/openid-configuration
 * 
 * This is an alias to /api/.well-known/openid-configuration
 * Some OIDC clients expect discovery at the root level
 */
export async function GET() {
    // Redirect to the actual endpoint
    const response = await fetch('http://localhost:3000/api/.well-known/openid-configuration');
    const data = await response.json();

    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
