import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/db-oauth';
import { getUserById } from '@/lib/db';
import { verifyJWT } from '@/lib/oidc/jwt';

/**
 * OAuth2 UserInfo Endpoint
 * GET /api/oauth/userinfo
 * 
 * Returns user profile information for the authenticated user.
 * Requires valid access token in Authorization header.
 */
export async function GET(request: NextRequest) {
    // Extract access token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'invalid_token', error_description: 'Missing or invalid authorization header' },
            { status: 401 }
        );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate access token
    let accessToken = getAccessToken(token);

    // If not found in DB, try verifying as JWT (for OIDC stateless tokens)
    if (!accessToken) {
        try {
            const payload = verifyJWT(token) as {
                sub: string;
                scope?: string;
                client_id?: string;
                aud?: string;
                exp: number;
                iat: number;
            };

            // Reconstruct access token object from JWT payload
            if (payload && payload.sub) {
                const scopes = payload.scope ? payload.scope.split(' ') : [];
                // Check for client_credentials case where sub might be client_id
                const isClientCredentials = payload.sub === payload.client_id;

                accessToken = {
                    id: 0, // Placeholder
                    token: token,
                    client_id: payload.client_id as string || payload.aud as string,
                    user_id: isClientCredentials ? null : parseInt(payload.sub),
                    scopes: scopes,
                    expires_at: new Date(payload.exp * 1000).toISOString(),
                    created_at: new Date(payload.iat * 1000).toISOString(),
                    revoked: false
                };
            }
        } catch (e) {
            // JWT verification failed
            console.error('UserInfo: JWT verification failed:', e);
        }
    }

    if (!accessToken) {
        return NextResponse.json(
            { error: 'invalid_token', error_description: 'Invalid or expired access token' },
            { status: 401 }
        );
    }

    // Client credentials grant doesn't have a user
    if (!accessToken.user_id) {
        return NextResponse.json(
            { error: 'invalid_token', error_description: 'Token is not associated with a user' },
            { status: 400 }
        );
    }

    // Get user information
    const user = getUserById(accessToken.user_id);
    if (!user) {
        return NextResponse.json(
            { error: 'invalid_token', error_description: 'User not found' },
            { status: 404 }
        );
    }

    // Build response based on granted scopes
    const scopes = accessToken.scopes;
    const userInfo: Record<string, string | boolean> = {
        sub: user.id.toString(),
    };

    // Add profile information if profile or username scope is granted
    if (scopes.includes('profile') || scopes.includes('username')) {
        userInfo.preferred_username = user.username;
        userInfo.name = user.username;
    }

    // Add email if email scope is granted
    if (scopes.includes('email') && user.email) {
        userInfo.email = user.email;
        userInfo.email_verified = true;
    }

    return NextResponse.json(userInfo);
}
