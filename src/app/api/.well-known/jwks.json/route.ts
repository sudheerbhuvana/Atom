import { NextResponse } from 'next/server';
import { getJWKS } from '../../../../lib/oidc/jwt';

/**
 * JWKS (JSON Web Key Set) Endpoint
 * GET /.well-known/jwks.json
 * 
 * Returns public keys for JWT verification
 */
export async function GET() {
    try {
        const jwks = getJWKS();

        return NextResponse.json(jwks, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
        });
    } catch (error) {
        console.error('JWKS error:', error);
        return NextResponse.json(
            { error: 'server_error' },
            { status: 500 }
        );
    }
}
