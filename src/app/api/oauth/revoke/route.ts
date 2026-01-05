import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/lib/oauth/provider';
import { validateClientCredentials } from '@/lib/oauth/provider';

/**
 * OAuth2 Token Revocation Endpoint
 * POST /api/oauth/revoke
 * 
 * Revokes an access or refresh token.
 * Requires client authentication.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const client_id = formData.get('client_id') as string;
        const client_secret = formData.get('client_secret') as string;
        const token = formData.get('token') as string;
        const token_type_hint = formData.get('token_type_hint') as 'access_token' | 'refresh_token' | null;

        // Validate client credentials
        const client = validateClientCredentials(client_id, client_secret);
        if (!client) {
            return NextResponse.json(
                { error: 'invalid_client' },
                { status: 401 }
            );
        }

        if (!token) {
            return NextResponse.json(
                { error: 'invalid_request', error_description: 'Missing token parameter' },
                { status: 400 }
            );
        }

        // Revoke token
        revokeToken(token, token_type_hint || undefined);

        // Per RFC 7009, revocation endpoint returns 200 even if token doesn't exist
        return NextResponse.json({});
    } catch (error) {
        console.error('Revocation endpoint error:', error);
        return NextResponse.json(
            { error: 'server_error' },
            { status: 500 }
        );
    }
}
