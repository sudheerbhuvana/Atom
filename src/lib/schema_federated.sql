-- External Identity Providers (OIDC Relying Party Config)
CREATE TABLE IF NOT EXISTS auth_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    issuer TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    authorization_endpoint TEXT,
    token_endpoint TEXT,
    userinfo_endpoint TEXT,
    jwks_uri TEXT,
    scopes TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Federated Identities (Links external users to local users)
CREATE TABLE IF NOT EXISTS federated_identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider_slug TEXT NOT NULL,
    subject TEXT NOT NULL,
    email TEXT, -- Snapshot of external email
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_slug, subject),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(provider_slug) REFERENCES auth_providers(slug) ON DELETE CASCADE
);

-- Index for fast lookups during login
CREATE INDEX IF NOT EXISTS idx_federated_lookup ON federated_identities(provider_slug, subject);
CREATE INDEX IF NOT EXISTS idx_federated_user ON federated_identities(user_id);
