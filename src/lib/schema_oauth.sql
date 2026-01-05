-- OAuth2/OIDC Provider Tables

-- OAuth2 Clients (Applications that can use SSO)
CREATE TABLE IF NOT EXISTS oauth_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    redirect_uris TEXT NOT NULL, -- JSON array of allowed redirect URIs
    allowed_scopes TEXT NOT NULL, -- JSON array of allowed scopes
    grant_types TEXT NOT NULL DEFAULT '["authorization_code","refresh_token"]', -- JSON array of allowed grant types
    is_confidential INTEGER DEFAULT 1, -- 1 for confidential (can keep secret), 0 for public
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OAuth2 Authorization Codes (temporary codes in authorization code flow)
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    redirect_uri TEXT NOT NULL,
    scopes TEXT NOT NULL, -- JSON array of granted scopes
    code_challenge TEXT, -- PKCE code challenge
    code_challenge_method TEXT, -- PKCE method (S256 or plain)
    nonce TEXT, -- OIDC nonce for ID token
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used INTEGER DEFAULT 0, -- 1 if code has been exchanged
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth2 Access Tokens
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER, -- NULL for client_credentials grant
    scopes TEXT NOT NULL, -- JSON array of scopes
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0, -- 1 if token has been revoked
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth2 Refresh Tokens
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    access_token_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    scopes TEXT NOT NULL, -- JSON array of scopes
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0, -- 1 if token has been revoked
    FOREIGN KEY (access_token_id) REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth2 User Consents (remember which apps user has authorized)
CREATE TABLE IF NOT EXISTS oauth_user_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    scopes TEXT NOT NULL, -- JSON array of granted scopes
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, client_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_codes_client ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_user ON oauth_authorization_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_access_client ON oauth_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_user ON oauth_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_expires ON oauth_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_client ON oauth_refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_user ON oauth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_consents_user ON oauth_user_consents(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_user_consents_unique ON oauth_user_consents(user_id, client_id);

-- ============================================================================
-- SAML 2.0 Service Providers (for SAML SSO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS saml_service_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    acs_url TEXT NOT NULL, -- Assertion Consumer Service URL
    metadata_url TEXT,
    sp_certificate TEXT, -- Service Provider's signing certificate (optional)
    attribute_mapping TEXT, -- JSON: map SAML attributes to user fields
    sign_assertions INTEGER DEFAULT 1, -- Sign SAML assertions
    encrypt_assertions INTEGER DEFAULT 0, -- Encrypt SAML assertions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saml_sp_entity ON saml_service_providers(entity_id);

-- ============================================================================
-- Protected Applications (for Authentication Proxy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS protected_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- URL slug: /proxy/{slug}/*
    backend_url TEXT NOT NULL, -- Backend service URL
    require_auth INTEGER DEFAULT 1, -- Require authentication
    allowed_users TEXT, -- JSON array of usernames, or null for all
    inject_headers INTEGER DEFAULT 1, -- Inject auth headers (X-Auth-User, etc.)
    strip_auth_header INTEGER DEFAULT 1, -- Strip Authorization header before proxying
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_protected_apps_slug ON protected_applications(slug);
