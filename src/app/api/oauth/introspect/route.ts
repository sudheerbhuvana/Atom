import { NextRequest, NextResponse } from 'next/server';
import { introspectToken } from '@/lib/oauth/provider';
import { validateClientCredentials } from '@/lib/oauth/provider';

/**
 * OAuth2 Token Introspection Endpoint
 * POST /api/oauth/introspect
 * 
 * Validates a token and returns metadata about it.
 * Requires client authentication.
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const client_id = formData.get('client_id') as string;
        const client_secret = formData.get('client_secret') as string;
        const token = formData.get('token') as string;

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

        // Introspect token
        const result = introspectToken(token);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Introspection endpoint error:', error);
        return NextResponse.json(
            { error: 'server_error' },
            { status: 500 }
        );
    }
}
