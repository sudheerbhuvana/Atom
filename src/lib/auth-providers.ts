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
    enabled: boolean;
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

// ============================================================================
// Auth Provider Operations
// ============================================================================

export function getAuthProviderBySlug(slug: string): AuthProvider | undefined {
    const row = getStmt('SELECT * FROM auth_providers WHERE slug = ?').get(slug);
    return row ? { ...(row as any), enabled: (row as any).enabled === 1 } as AuthProvider : undefined;
}

export function listAuthProviders(): AuthProvider[] {
    const rows = getStmt('SELECT * FROM auth_providers ORDER BY name ASC').all();
    return rows.map(row => ({ ...(row as any), enabled: (row as any).enabled === 1 } as AuthProvider));
}

export function listEnabledAuthProviders(): AuthProvider[] {
    const rows = getStmt('SELECT * FROM auth_providers WHERE enabled = 1 ORDER BY name ASC').all();
    return rows.map(row => ({ ...(row as any), enabled: (row as any).enabled === 1 } as AuthProvider));
}

export function createAuthProvider(
    data: Omit<AuthProvider, 'id' | 'created_at' | 'updated_at'>
): AuthProvider {
    const stmt = getStmt(`
        INSERT INTO auth_providers (name, slug, issuer, client_id, client_secret, authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        data.enabled ? 1 : 0
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
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

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
