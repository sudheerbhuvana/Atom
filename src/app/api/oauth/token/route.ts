import { NextRequest, NextResponse } from 'next/server';
import { handleTokenRequest, type TokenParams } from '@/lib/oauth/provider';

/**
 * OAuth2 Token Endpoint
 * POST /api/oauth/token
 * 
 * Handles token requests for all grant types:
 * - authorization_code
 * - client_credentials
 * - refresh_token
 */
export async function POST(request: NextRequest) {
    try {
        // Parse form data (OAuth2 tokens use application/x-www-form-urlencoded)
        const formData = await request.formData();

        // Dynamically determine issuer URL from request headers
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const issuer = `${protocol}://${host}`;

        // Check for Basic Auth header
        let clientId = formData.get('client_id') as string || '';
        let clientSecret = formData.get('client_secret') as string || '';

        console.log('Token Endpoint: Initial body credentials:', { clientId: clientId ? '***' : 'missing', hasSecret: !!clientSecret });

        const authHeader = request.headers.get('authorization');
        if (!clientId && authHeader && authHeader.startsWith('Basic ')) {
            try {
                const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
                clientId = credentials[0];
                clientSecret = credentials[1];
                console.log('Token Endpoint: Extracted credentials from Basic Auth header');
            } catch (e) {
                console.error('Failed to parse Basic Auth header:', e);
            }
        }

        // console.log('Token Endpoint: Final credentials:', { clientId, hasSecret: !!clientSecret });

        const params: TokenParams = {
            grant_type: formData.get('grant_type') as string || '',
            code: formData.get('code') as string || undefined,
            redirect_uri: formData.get('redirect_uri') as string || undefined,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier: formData.get('code_verifier') as string || undefined,
            refresh_token: formData.get('refresh_token') as string || undefined,
            scope: formData.get('scope') as string || undefined,
            issuer, // Pass dynamic issuer
        };

        // Handle token request
        const result = handleTokenRequest(params);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error,
                    error_description: result.error_description,
                },
                { status: 400 }
            );
        }

        // Return successful token response
        return NextResponse.json({
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            refresh_token: result.refresh_token,
            scope: result.scope,
            id_token: result.id_token, // Include ID token for OIDC
        });
    } catch (error) {
        console.error('Token endpoint error:', error);
        return NextResponse.json(
            {
                error: 'server_error',
                error_description: 'An internal server error occurred',
            },
            { status: 500 }
        );
    }
}
