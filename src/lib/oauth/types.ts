// OAuth2/OIDC Type Definitions

export interface OAuthClient {
    id: number;
    client_id: string;
    client_secret: string;
    name: string;
    description?: string;
    redirect_uris: string[]; // Stored as JSON in DB
    allowed_scopes: string[]; // Stored as JSON in DB
    grant_types: string[]; // Stored as JSON in DB
    is_confidential: boolean;
    created_at: string;
    updated_at: string;
}

export interface OAuthAuthorizationCode {
    id: number;
    code: string;
    client_id: string;
    user_id: number;
    redirect_uri: string;
    scopes: string[]; // Stored as JSON in DB
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
    nonce?: string; // OIDC nonce for ID token
    expires_at: string;
    created_at: string;
    used: boolean;
}

export interface OAuthAccessToken {
    id: number;
    token: string;
    client_id: string;
    user_id: number | null; // null for client_credentials grant
    scopes: string[]; // Stored as JSON in DB
    expires_at: string;
    created_at: string;
    revoked: boolean;
}

export interface OAuthRefreshToken {
    id: number;
    token: string;
    access_token_id: number;
    client_id: string;
    user_id: number;
    scopes: string[]; // Stored as JSON in DB
    expires_at: string;
    created_at: string;
    revoked: boolean;
}

export interface OAuthUserConsent {
    id: number;
    user_id: number;
    client_id: string;
    scopes: string[]; // Stored as JSON in DB
    granted_at: string;
    updated_at: string;
}

// Request/Response types for OAuth2 flows

export interface AuthorizeRequest {
    response_type: 'code';
    client_id: string;
    redirect_uri: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: 'S256' | 'plain';
}

export interface TokenRequest {
    grant_type: 'authorization_code' | 'client_credentials' | 'refresh_token';
    code?: string; // Required for authorization_code
    redirect_uri?: string; // Required for authorization_code
    client_id: string;
    client_secret: string;
    code_verifier?: string; // Required for PKCE
    refresh_token?: string; // Required for refresh_token grant
    scope?: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token?: string;
    scope: string;
}

export interface UserInfoResponse {
    sub: string; // User ID
    preferred_username?: string;
    email?: string;
    name?: string;
}

export interface IntrospectRequest {
    token: string;
    token_type_hint?: 'access_token' | 'refresh_token';
}

export interface IntrospectResponse {
    active: boolean;
    scope?: string;
    client_id?: string;
    username?: string;
    token_type?: 'Bearer';
    exp?: number;
    iat?: number;
    sub?: string;
}

export interface RevokeRequest {
    token: string;
    token_type_hint?: 'access_token' | 'refresh_token';
}

// Client creation request
export interface CreateOAuthClientRequest {
    name: string;
    description?: string;
    redirect_uris: string[];
    allowed_scopes?: string[];
    grant_types?: string[];
    is_confidential?: boolean;
}

// Safe client response (without secret for listing)
export type OAuthClientSafe = Omit<OAuthClient, 'client_secret'>;

// Supported scopes
export const SUPPORTED_SCOPES = ['openid', 'profile', 'username', 'email'] as const;
export type SupportedScope = typeof SUPPORTED_SCOPES[number];

// Supported grant types
export const SUPPORTED_GRANT_TYPES = ['authorization_code', 'client_credentials', 'refresh_token'] as const;
export type SupportedGrantType = typeof SUPPORTED_GRANT_TYPES[number];
