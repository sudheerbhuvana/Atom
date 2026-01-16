import crypto from 'crypto';
import {
    getOAuthClientByClientId,
    createAuthorizationCode,
    getAuthorizationCode,
    markAuthorizationCodeAsUsed,
    createAccessToken,
    createRefreshToken,
    getAccessToken,
    getRefreshToken,
    revokeAccessToken,
    revokeRefreshToken,
    saveUserConsent,
    getUserConsent,
} from '../db-oauth';
import type { OAuthClient } from './types';

// Constants
const DEFAULT_TOKEN_EXPIRY = parseInt(process.env.OAUTH_TOKEN_EXPIRY || '3600'); // 1 hour
const DEFAULT_CODE_EXPIRY = parseInt(process.env.OAUTH_CODE_EXPIRY || '600'); // 10 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

// ============================================================================
// PKCE (Proof Key for Code Exchange) Support
// ============================================================================

/**
 * Verify PKCE code verifier against code challenge
 * Supports both S256 and plain methods
 */
export function verifyPKCE(
    verifier: string,
    challenge: string,
    method: 'S256' | 'plain'
): boolean {
    if (method === 'plain') {
        return verifier === challenge;
    }

    // S256: BASE64URL(SHA256(code_verifier))
    const hash = crypto.createHash('sha256').update(verifier).digest();
    const computed = base64UrlEncode(hash);
    return computed === challenge;
}

/**
 * Base64 URL encoding (without padding)
 */
function base64UrlEncode(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate redirect URI against client's registered URIs
 */
export function validateRedirectUri(client: OAuthClient, redirect_uri: string): boolean {
    return client.redirect_uris.includes(redirect_uri);
}

/**
 * Validate requested scopes against client's allowed scopes
 */
export function validateScopes(client: OAuthClient, requested_scopes: string[]): boolean {
    return requested_scopes.every(scope => client.allowed_scopes.includes(scope));
}

/**
 * Validate grant type is allowed for client
 */
export function validateGrantType(client: OAuthClient, grant_type: string): boolean {
    return client.grant_types.includes(grant_type);
}

/**
 * Parse scope string into array
 */
export function parseScopes(scope?: string): string[] {
    if (!scope) return ['openid']; // Default scope
    return scope.split(' ').filter(s => s.length > 0);
}

/**
 * Validate client credentials
 */
export function validateClientCredentials(
    client_id: string,
    client_secret: string
): OAuthClient | null {
    const client = getOAuthClientByClientId(client_id);
    if (!client) {
        console.log(`OAuth Client lookup failed for ID: ${client_id}`);
        return null;
    }

    // For public clients, secret validation is skipped
    if (!client.is_confidential) return client;

    // For confidential clients, validate secret
    if (client.client_secret !== client_secret) {
        return null;
    }

    return client;
}

// ============================================================================
// Authorization Code Flow
// ============================================================================

export interface AuthorizeParams {
    client_id: string;
    redirect_uri: string;
    response_type: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
    nonce?: string; // OIDC nonce for replay protection
}

export interface AuthorizeResult {
    success: boolean;
    error?: string;
    error_description?: string;
    client?: OAuthClient;
    scopes?: string[];
}

/**
 * Validate authorization request parameters
 */
export function validateAuthorizeRequest(params: AuthorizeParams): AuthorizeResult {
    // Validate response_type
    if (params.response_type !== 'code') {
        return {
            success: false,
            error: 'unsupported_response_type',
            error_description: 'Only "code" response type is supported',
        };
    }

    // Validate client
    const client = getOAuthClientByClientId(params.client_id);
    if (!client) {
        return {
            success: false,
            error: 'invalid_client',
            error_description: 'Client not found',
        };
    }

    // Validate redirect URI
    if (!validateRedirectUri(client, params.redirect_uri)) {
        return {
            success: false,
            error: 'invalid_request',
            error_description: 'Invalid redirect_uri',
        };
    }

    // Validate scopes
    const scopes = parseScopes(params.scope);
    if (!validateScopes(client, scopes)) {
        return {
            success: false,
            error: 'invalid_scope',
            error_description: 'Requested scope is not allowed for this client',
        };
    }

    // Validate authorization_code grant is allowed
    if (!validateGrantType(client, 'authorization_code')) {
        return {
            success: false,
            error: 'unauthorized_client',
            error_description: 'Client is not authorized for authorization code flow',
        };
    }

    // PKCE validation (S256 is recommended, but both are supported)
    if (params.code_challenge) {
        if (!params.code_challenge_method) {
            return {
                success: false,
                error: 'invalid_request',
                error_description: 'code_challenge_method is required when using PKCE',
            };
        }
        if (params.code_challenge_method !== 'S256' && params.code_challenge_method !== 'plain') {
            return {
                success: false,
                error: 'invalid_request',
                error_description: 'Unsupported code_challenge_method',
            };
        }
    }

    return {
        success: true,
        client,
        scopes,
    };
}

/**
 * Generate authorization code after user consent
 */
export function generateAuthorizationCode(
    client_id: string,
    user_id: number,
    redirect_uri: string,
    scopes: string[],
    code_challenge?: string,
    code_challenge_method?: 'S256' | 'plain',
    nonce?: string
): string {
    const authCode = createAuthorizationCode(
        client_id,
        user_id,
        redirect_uri,
        scopes,
        code_challenge,
        code_challenge_method,
        nonce,
        DEFAULT_CODE_EXPIRY
    );

    // Save user consent for future requests
    saveUserConsent(user_id, client_id, scopes);

    return authCode.code;
}

// ============================================================================
// Token Exchange
// ============================================================================

export interface TokenParams {
    grant_type: string;
    code?: string;
    redirect_uri?: string;
    client_id: string;
    client_secret: string;
    code_verifier?: string;
    refresh_token?: string;
    scope?: string;
    issuer?: string; // Dynamic issuer URL
}

export interface TokenResult {
    success: boolean;
    error?: string;
    error_description?: string;
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string; // For OIDC
}

/**
 * Handle token request (authorization_code, client_credentials, refresh_token grants)
 */
export function handleTokenRequest(params: TokenParams): TokenResult {
    // Validate client credentials
    const client = validateClientCredentials(params.client_id, params.client_secret);
    if (!client) {
        return {
            success: false,
            error: 'invalid_client',
            error_description: 'Invalid client credentials',
        };
    }

    // Validate grant type is allowed
    if (!validateGrantType(client, params.grant_type)) {
        return {
            success: false,
            error: 'unauthorized_client',
            error_description: 'Client is not authorized for this grant type',
        };
    }

    // Handle different grant types
    switch (params.grant_type) {
        case 'authorization_code':
            return handleAuthorizationCodeGrant(client, params);
        case 'client_credentials':
            return handleClientCredentialsGrant(client, params);
        case 'refresh_token':
            return handleRefreshTokenGrant(client, params);
        default:
            return {
                success: false,
                error: 'unsupported_grant_type',
                error_description: `Grant type "${params.grant_type}" is not supported`,
            };
    }
}

/**
 * Handle authorization_code grant
 */
function handleAuthorizationCodeGrant(client: OAuthClient, params: TokenParams): TokenResult {
    if (!params.code) {
        return {
            success: false,
            error: 'invalid_request',
            error_description: 'Missing authorization code',
        };
    }

    if (!params.redirect_uri) {
        return {
            success: false,
            error: 'invalid_request',
            error_description: 'Missing redirect_uri',
        };
    }

    // Get authorization code
    const authCode = getAuthorizationCode(params.code);
    if (!authCode) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
        };
    }

    // Validate authorization code
    if (authCode.used) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Authorization code has already been used',
        };
    }

    if (authCode.client_id !== client.client_id) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Authorization code was issued to a different client',
        };
    }

    if (authCode.redirect_uri !== params.redirect_uri) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Redirect URI mismatch',
        };
    }

    // Check if expired
    if (new Date(authCode.expires_at).getTime() < Date.now()) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Authorization code has expired',
        };
    }

    // Validate PKCE if code challenge was provided
    if (authCode.code_challenge) {
        if (!params.code_verifier) {
            return {
                success: false,
                error: 'invalid_request',
                error_description: 'Missing code_verifier for PKCE',
            };
        }

        const valid = verifyPKCE(
            params.code_verifier,
            authCode.code_challenge,
            authCode.code_challenge_method || 'S256'
        );

        if (!valid) {
            return {
                success: false,
                error: 'invalid_grant',
                error_description: 'Invalid PKCE code_verifier',
            };
        }
    }

    // Mark code as used
    markAuthorizationCodeAsUsed(params.code);

    // Check if openid scope is present for OIDC
    const isOIDC = authCode.scopes.includes('openid');

    if (isOIDC) {
        // Use JWT tokens for OIDC flow
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { generateOIDCTokenResponse } = require('./oidc-tokens');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getUserById } = require('../db');

        const user = getUserById(authCode.user_id);
        if (!user) {
            return {
                success: false,
                error: 'server_error',
                error_description: 'User not found',
            };
        }

        // Generate refresh token if offline_access scope is granted
        let refreshToken: string | undefined;
        if (authCode.scopes.includes('offline_access') && validateGrantType(client, 'refresh_token')) {
            // For now, create regular refresh token (can be JWT later)
            const refreshTokenObj = createRefreshToken(
                -1, // Placeholder, will need access token ID
                client.client_id,
                authCode.user_id,
                authCode.scopes,
                DEFAULT_REFRESH_TOKEN_EXPIRY
            );
            refreshToken = refreshTokenObj.token;
        }

        return generateOIDCTokenResponse(
            client,
            authCode.user_id,
            authCode.scopes,
            DEFAULT_TOKEN_EXPIRY,
            refreshToken,
            authCode.nonce,
            params.issuer // Pass dynamic issuer
        );
    }

    // Fallback: Use regular bearer tokens for non-OIDC flows
    const accessToken = createAccessToken(
        client.client_id,
        authCode.user_id,
        authCode.scopes,
        DEFAULT_TOKEN_EXPIRY
    );

    // Generate refresh token if offline_access scope is granted
    let refreshToken: string | undefined;
    if (authCode.scopes.includes('offline_access') && validateGrantType(client, 'refresh_token')) {
        const refreshTokenObj = createRefreshToken(
            accessToken.id,
            client.client_id,
            authCode.user_id,
            authCode.scopes,
            DEFAULT_REFRESH_TOKEN_EXPIRY
        );
        refreshToken = refreshTokenObj.token;
    }

    return {
        success: true,
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: DEFAULT_TOKEN_EXPIRY,
        refresh_token: refreshToken,
        scope: authCode.scopes.join(' '),
    };
}

/**
 * Handle client_credentials grant
 */
function handleClientCredentialsGrant(client: OAuthClient, params: TokenParams): TokenResult {
    const scopes = parseScopes(params.scope);

    // Validate scopes
    if (!validateScopes(client, scopes)) {
        return {
            success: false,
            error: 'invalid_scope',
            error_description: 'Requested scope is not allowed for this client',
        };
    }

    // Generate access token (no user_id for client credentials)
    const accessToken = createAccessToken(
        client.client_id,
        null,
        scopes,
        DEFAULT_TOKEN_EXPIRY
    );

    return {
        success: true,
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: DEFAULT_TOKEN_EXPIRY,
        scope: scopes.join(' '),
    };
}

/**
 * Handle refresh_token grant
 */
function handleRefreshTokenGrant(client: OAuthClient, params: TokenParams): TokenResult {
    if (!params.refresh_token) {
        return {
            success: false,
            error: 'invalid_request',
            error_description: 'Missing refresh_token',
        };
    }

    // Get refresh token
    const refreshTokenObj = getRefreshToken(params.refresh_token);
    if (!refreshTokenObj) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Invalid or expired refresh token',
        };
    }

    // Validate refresh token belongs to client
    if (refreshTokenObj.client_id !== client.client_id) {
        return {
            success: false,
            error: 'invalid_grant',
            error_description: 'Refresh token was issued to a different client',
        };
    }

    // Generate new access token
    const accessToken = createAccessToken(
        client.client_id,
        refreshTokenObj.user_id,
        refreshTokenObj.scopes,
        DEFAULT_TOKEN_EXPIRY
    );

    // Optionally generate new refresh token (token rotation)
    // For now, we'll keep the same refresh token

    return {
        success: true,
        access_token: accessToken.token,
        token_type: 'Bearer',
        expires_in: DEFAULT_TOKEN_EXPIRY,
        refresh_token: refreshTokenObj.token,
        scope: refreshTokenObj.scopes.join(' '),
    };
}

// ============================================================================
// Token Introspection
// ============================================================================

export interface IntrospectResult {
    active: boolean;
    scope?: string;
    client_id?: string;
    username?: string;
    token_type?: 'Bearer';
    exp?: number;
    iat?: number;
    sub?: string;
}

/**
 * Introspect access token
 */
export function introspectToken(token: string): IntrospectResult {
    const accessToken = getAccessToken(token);
    if (!accessToken) {
        return { active: false };
    }

    const expiresAt = new Date(accessToken.expires_at);
    const createdAt = new Date(accessToken.created_at);

    return {
        active: true,
        scope: accessToken.scopes.join(' '),
        client_id: accessToken.client_id,
        token_type: 'Bearer',
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: Math.floor(createdAt.getTime() / 1000),
        sub: accessToken.user_id?.toString(),
    };
}

// ============================================================================
// Token Revocation
// ============================================================================

/**
 * Revoke access or refresh token
 */
export function revokeToken(token: string, token_type_hint?: 'access_token' | 'refresh_token'): boolean {
    if (token_type_hint === 'refresh_token') {
        return revokeRefreshToken(token);
    }

    // Try access token first, then refresh token
    if (revokeAccessToken(token)) {
        return true;
    }

    return revokeRefreshToken(token);
}
