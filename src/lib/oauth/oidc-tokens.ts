/**
 * Enhanced OAuth2 token generation with OIDC/JWT support
 * 
 * This file extends the OAuth2 provider to support JWT tokens and ID tokens
 */

import { generateIDToken, generateAccessTokenJWT } from '../oidc/jwt';
import { getUserById } from '../db';
import type { TokenResult } from './provider';
import type { OAuthClient } from './types';

/**
 * Generate token response with JWT tokens (OIDC compatible)
 * Used for authorization_code grant
 */
export function generateOIDCTokenResponse(
    client: OAuthClient,
    userId: number,
    scopes: string[],
    expiresIn: number,
    refreshToken?: string,
    nonce?: string,
    issuer?: string
): TokenResult {
    // Get user information for ID token
    const user = getUserById(userId);
    if (!user) {
        return {
            success: false,
            error: 'server_error',
            error_description: 'User not found',
        };
    }

    // Generate JWT access token
    const accessToken = generateAccessTokenJWT(
        userId,
        client.client_id,
        scopes,
        expiresIn,
        issuer
    );

    // Generate ID token if openid scope is requested
    let idToken: string | undefined;
    if (scopes.includes('openid')) {
        // Include email in ID token if email scope is present
        const email = scopes.includes('email') ? user.email : undefined;

        idToken = generateIDToken(
            userId,
            user.username,
            client.client_id,
            email,
            nonce,
            expiresIn,
            issuer
        );
    }

    return {
        success: true,
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        id_token: idToken,
        refresh_token: refreshToken,
        scope: scopes.join(' '),
    };
}

/**
 * Generate token response for client_credentials grant
 */
export function generateClientCredentialsTokenResponse(
    client: OAuthClient,
    scopes: string[],
    expiresIn: number
): TokenResult {
    // Generate JWT access token (no user ID for client credentials)
    const accessToken = generateAccessTokenJWT(
        null,
        client.client_id,
        scopes,
        expiresIn
    );

    return {
        success: true,
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: scopes.join(' '),
    };
}
