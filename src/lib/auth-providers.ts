import db from './db';
import Database from 'better-sqlite3';

// Types
export interface AuthProvider {
    id: number;
    name: string;
    slug: string;
    issuer: string;
    client_id: string;
    client_secret: string;
    authorization_endpoint?: string;
    token_endpoint?: string;
    userinfo_endpoint?: string;
    jwks_uri?: string;
    scopes?: string; // e.g. "openid profile email"
    enabled: boolean;
    user_match_field?: 'email' | 'username' | 'sub';
    auto_register?: boolean;
    auto_launch?: boolean;
    created_at: string;
    updated_at: string;
}

export interface FederatedIdentity {
    id: number;
    user_id: number;
    provider_slug: string;
    subject: string;
    email?: string;
    created_at: string;
}

// Prepared Statement Helpers
const preparedStmts = new Map<string, Database.Statement>();

function getStmt(sql: string): Database.Statement {
    if (!preparedStmts.has(sql)) {
        preparedStmts.set(sql, db.prepare(sql));
    }
    return preparedStmts.get(sql)!;
}

// Helper to safely cast DB row
function mapProvider(row: unknown): AuthProvider {
    const r = row as Omit<AuthProvider, 'enabled' | 'auto_register' | 'auto_launch'> & {
        enabled: number;
        auto_register?: number;
        auto_launch?: number;
    };
    return {
        ...r,
        enabled: r.enabled === 1,
        auto_register: r.auto_register === 1,
        auto_launch: r.auto_launch === 1
    };
}

// ============================================================================
// Auth Provider Operations
// ============================================================================

export function getAuthProviderBySlug(slug: string): AuthProvider | undefined {
    const row = getStmt('SELECT * FROM auth_providers WHERE slug = ?').get(slug);
    return row ? mapProvider(row) : undefined;
}

export function getAllAuthProviders(): AuthProvider[] {
    const rows = getStmt('SELECT * FROM auth_providers ORDER BY name ASC').all();
    return rows.map(mapProvider);
}

export function listEnabledAuthProviders(): AuthProvider[] {
    const rows = getStmt('SELECT * FROM auth_providers WHERE enabled = 1 ORDER BY name ASC').all();
    return rows.map(mapProvider);
}

export function createAuthProvider(
    data: Omit<AuthProvider, 'id' | 'created_at' | 'updated_at'>
): AuthProvider {
    const stmt = getStmt(`
        INSERT INTO auth_providers (name, slug, issuer, client_id, client_secret, authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri, scopes, enabled, user_match_field, auto_register, auto_launch)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        data.name,
        data.slug,
        data.issuer,
        data.client_id,
        data.client_secret,
        data.authorization_endpoint || null,
        data.token_endpoint || null,
        data.userinfo_endpoint || null,
        data.jwks_uri || null,
        data.scopes || null,
        data.enabled ? 1 : 0,
        data.user_match_field || 'email',
        data.auto_register !== undefined ? (data.auto_register ? 1 : 0) : 1,
        data.auto_launch ? 1 : 0
    );

    return getAuthProviderBySlug(data.slug)!;
}

export function updateAuthProvider(slug: string, updates: Partial<AuthProvider>): boolean {
    const current = getAuthProviderBySlug(slug);
    if (!current) return false;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.issuer !== undefined) { fields.push('issuer = ?'); values.push(updates.issuer); }
    if (updates.client_id !== undefined) { fields.push('client_id = ?'); values.push(updates.client_id); }
    if (updates.client_secret !== undefined) { fields.push('client_secret = ?'); values.push(updates.client_secret); }
    if (updates.authorization_endpoint !== undefined) { fields.push('authorization_endpoint = ?'); values.push(updates.authorization_endpoint); }
    if (updates.token_endpoint !== undefined) { fields.push('token_endpoint = ?'); values.push(updates.token_endpoint); }
    if (updates.userinfo_endpoint !== undefined) { fields.push('userinfo_endpoint = ?'); values.push(updates.userinfo_endpoint); }
    if (updates.jwks_uri !== undefined) { fields.push('jwks_uri = ?'); values.push(updates.jwks_uri); }
    if (updates.scopes !== undefined) { fields.push('scopes = ?'); values.push(updates.scopes); }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    if (updates.user_match_field !== undefined) { fields.push('user_match_field = ?'); values.push(updates.user_match_field); }
    if (updates.auto_register !== undefined) { fields.push('auto_register = ?'); values.push(updates.auto_register ? 1 : 0); }
    if (updates.auto_launch !== undefined) { fields.push('auto_launch = ?'); values.push(updates.auto_launch ? 1 : 0); }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    values.push(slug);

    const sql = `UPDATE auth_providers SET ${fields.join(', ')} WHERE slug = ?`;
    db.prepare(sql).run(...values);
    return true;
}

export function deleteAuthProvider(slug: string): boolean {
    const result = getStmt('DELETE FROM auth_providers WHERE slug = ?').run(slug);
    return result.changes > 0;
}

// ============================================================================
// Federated Identity Operations
// ============================================================================

export function getFederatedIdentity(providerSlug: string, subject: string): FederatedIdentity | undefined {
    return getStmt('SELECT * FROM federated_identities WHERE provider_slug = ? AND subject = ?')
        .get(providerSlug, subject) as FederatedIdentity | undefined;
}

export function linkFederatedIdentity(
    userId: number,
    providerSlug: string,
    subject: string,
    email?: string
): FederatedIdentity {
    const stmt = getStmt('INSERT INTO federated_identities (user_id, provider_slug, subject, email) VALUES (?, ?, ?, ?)');
    stmt.run(userId, providerSlug, subject, email || null);

    return getFederatedIdentity(providerSlug, subject)!;
}

export function unlinkFederatedIdentity(providerSlug: string, subject: string): boolean {
    const result = getStmt('DELETE FROM federated_identities WHERE provider_slug = ? AND subject = ?').run(providerSlug, subject);
    return result.changes > 0;
}
