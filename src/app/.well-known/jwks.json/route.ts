import { NextResponse } from 'next/server';

/**
 * JWKS endpoint (root level)
 * GET /.well-known/jwks.json
 * 
 * This is an alias to /api/.well-known/jwks.json
 * Some OIDC clients expect JWKS at the root level
 */
export async function GET() {
    // Redirect to the actual endpoint
    const response = await fetch('http://localhost:3000/api/.well-known/jwks.json');
    const data = await response.json();

    return NextResponse.json(data, {
        headers: {
            'Cache-Control': 'public, max-age=86400',
        },
    });
}
