/**
 * OIDC Discovery Configuration Generator
 * Generates OpenID Connect Discovery metadata
 */

export interface OIDCConfiguration {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
    response_types_supported: string[];
    subject_types_supported: string[];
    id_token_signing_alg_values_supported: string[];
    scopes_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    claims_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
}

/**
 * Generate OIDC Discovery configuration
 */
export function getOIDCConfiguration(baseUrl?: string): OIDCConfiguration {
    const issuer = baseUrl || process.env.OAUTH_ISSUER_URL || 'http://localhost:3000';

    return {
        issuer,
        authorization_endpoint: `${issuer}/api/oauth/authorize`,
        token_endpoint: `${issuer}/api/oauth/token`,
        userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
        jwks_uri: `${issuer}/api/.well-known/jwks.json`,

        response_types_supported: [
            'code',
            'id_token',
            'token id_token',
            'code id_token',
            'code token',
            'code token id_token',
        ],

        subject_types_supported: ['public'],

        id_token_signing_alg_values_supported: ['RS256'],

        scopes_supported: [
            'openid',
            'profile',
            'email',
            'offline_access',
        ],

        token_endpoint_auth_methods_supported: [
            'client_secret_post',
            'client_secret_basic',
        ],

        claims_supported: [
            'sub',
            'iss',
            'aud',
            'exp',
            'iat',
            'name',
            'preferred_username',
            'email',
            'email_verified',
        ],

        grant_types_supported: [
            'authorization_code',
            'refresh_token',
            'client_credentials',
        ],

        code_challenge_methods_supported: ['S256', 'plain'],
    };
}
