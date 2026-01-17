import Database from 'better-sqlite3';
import db from './db';
import type {
    OAuthClient,
    OAuthAuthorizationCode,
    OAuthAccessToken,
    OAuthRefreshToken,
    OAuthUserConsent,
} from './oauth/types';

// Helper to get or create prepared statement
const preparedStmts = new Map<string, Database.Statement>();

function getStmt(sql: string): Database.Statement {
    if (!preparedStmts.has(sql)) {
        preparedStmts.set(sql, db.prepare(sql));
    }
    return preparedStmts.get(sql)!;
}

// Helper to parse JSON fields from database
function parseJsonField<T>(data: string): T {
    try {
        return JSON.parse(data);
    } catch {
        return [] as T;
    }
}

// Helper to serialize JSON fields for database
function serializeJsonField<T>(data: T): string {
    return JSON.stringify(data);
}

// ============================================================================
// OAuth Client Operations
// ============================================================================

export function createOAuthClient(
    name: string,
    description: string | undefined,
    redirect_uris: string[],
    allowed_scopes: string[],
    grant_types: string[] = ['authorization_code', 'refresh_token'],
    is_confidential = true
): OAuthClient {
    const client_id = crypto.randomUUID();
    const client_secret = crypto.randomUUID().replace(/-/g, ''); // Remove dashes for cleaner secret

    const stmt = getStmt(`
        INSERT INTO oauth_clients (client_id, client_secret, name, description, redirect_uris, allowed_scopes, grant_types, is_confidential)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        client_id,
        client_secret,
        name,
        description || null,
        serializeJsonField(redirect_uris),
        serializeJsonField(allowed_scopes),
        serializeJsonField(grant_types),
        is_confidential ? 1 : 0
    );

    return getOAuthClientByClientId(client_id)!;
}

interface RawOAuthClient {
    id: number;
    client_id: string;
    client_secret: string;
    name: string;
    description: string | null;
    redirect_uris: string;
    allowed_scopes: string;
    grant_types: string;
    is_confidential: number;
    created_at: string;
    updated_at: string;
}

export function getOAuthClientByClientId(client_id: string): OAuthClient | undefined {
    const row = getStmt('SELECT * FROM oauth_clients WHERE client_id = ?').get(client_id) as RawOAuthClient | undefined;
    if (!row) return undefined;

    return {
        ...row,
        description: row.description || undefined,
        redirect_uris: parseJsonField(row.redirect_uris),
        allowed_scopes: parseJsonField(row.allowed_scopes),
        grant_types: parseJsonField(row.grant_types),
        is_confidential: row.is_confidential === 1,
    };
}

export function getOAuthClientById(id: number): OAuthClient | undefined {
    const row = getStmt('SELECT * FROM oauth_clients WHERE id = ?').get(id) as RawOAuthClient | undefined;
    if (!row) return undefined;

    return {
        ...row,
        description: row.description || undefined,
        redirect_uris: parseJsonField(row.redirect_uris),
        allowed_scopes: parseJsonField(row.allowed_scopes),
        grant_types: parseJsonField(row.grant_types),
        is_confidential: row.is_confidential === 1,
    };
}

export function listOAuthClients(): OAuthClient[] {
    const rows = getStmt('SELECT * FROM oauth_clients ORDER BY created_at DESC').all() as RawOAuthClient[];
    return rows.map(row => ({
        ...row,
        description: row.description || undefined,
        redirect_uris: parseJsonField(row.redirect_uris),
        allowed_scopes: parseJsonField(row.allowed_scopes),
        grant_types: parseJsonField(row.grant_types),
        is_confidential: row.is_confidential === 1,
    }));
}

export function updateOAuthClient(
    client_id: string,
    updates: {
        name?: string;
        description?: string; // Optional in interface, nullable in DB
        redirect_uris?: string[];
        allowed_scopes?: string[];
        grant_types?: string[];
    }
): boolean {
    const client = getOAuthClientByClientId(client_id);
    if (!client) return false;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
    }
    if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
    }
    if (updates.redirect_uris !== undefined) {
        fields.push('redirect_uris = ?');
        values.push(serializeJsonField(updates.redirect_uris));
    }
    if (updates.allowed_scopes !== undefined) {
        fields.push('allowed_scopes = ?');
        values.push(serializeJsonField(updates.allowed_scopes));
    }
    if (updates.grant_types !== undefined) {
        fields.push('grant_types = ?');
        values.push(serializeJsonField(updates.grant_types));
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    values.push(client_id);

    const sql = `UPDATE oauth_clients SET ${fields.join(', ')} WHERE client_id = ?`;
    db.prepare(sql).run(...values);
    return true;
}

export function deleteOAuthClient(client_id: string): boolean {
    const result = getStmt('DELETE FROM oauth_clients WHERE client_id = ?').run(client_id);
    return result.changes > 0;
}

// ============================================================================
// Authorization Code Operations
// ============================================================================

export function createAuthorizationCode(
    client_id: string,
    user_id: number,
    redirect_uri: string,
    scopes: string[],
    code_challenge?: string,
    code_challenge_method?: 'S256' | 'plain',
    nonce?: string,
    expiresInSeconds = 600 // 10 minutes default
): OAuthAuthorizationCode {
    const code = crypto.randomUUID().replace(/-/g, '');
    const expires_at = new Date(Date.now() + expiresInSeconds * 1000);

    const stmt = getStmt(`
        INSERT INTO oauth_authorization_codes (code, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, nonce, expires_at)        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        code,
        client_id,
        user_id,
        redirect_uri,
        serializeJsonField(scopes),
        code_challenge || null,
        code_challenge_method || null,
        nonce || null,
        expires_at.toISOString()
    );

    return getAuthorizationCode(code)!;
}

interface RawAuthorizationCode {
    id: number;
    code: string;
    client_id: string;
    user_id: number;
    redirect_uri: string;
    scopes: string;
    code_challenge: string | null;
    code_challenge_method: 'S256' | 'plain' | null;
    nonce: string | null;
    expires_at: string;
    created_at: string;
    used: number;
}

export function getAuthorizationCode(code: string): OAuthAuthorizationCode | undefined {
    const row = getStmt('SELECT * FROM oauth_authorization_codes WHERE code = ?').get(code) as RawAuthorizationCode | undefined;
    if (!row) return undefined;

    return {
        ...row,
        code_challenge: row.code_challenge || undefined,
        code_challenge_method: row.code_challenge_method || undefined,
        nonce: row.nonce || undefined,
        scopes: parseJsonField(row.scopes),
        used: row.used === 1,
    };
}

export function markAuthorizationCodeAsUsed(code: string): void {
    getStmt('UPDATE oauth_authorization_codes SET used = 1 WHERE code = ?').run(code);
}

export function deleteAuthorizationCode(code: string): void {
    getStmt('DELETE FROM oauth_authorization_codes WHERE code = ?').run(code);
}

export function cleanupExpiredAuthorizationCodes(): void {
    getStmt("DELETE FROM oauth_authorization_codes WHERE expires_at < datetime('now')").run();
}

// ============================================================================
// Access Token Operations
// ============================================================================

export function createAccessToken(
    client_id: string,
    user_id: number | null,
    scopes: string[],
    expiresInSeconds = 3600 // 1 hour default
): OAuthAccessToken {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expires_at = new Date(Date.now() + expiresInSeconds * 1000);

    const stmt = getStmt(`
        INSERT INTO oauth_access_tokens (token, client_id, user_id, scopes, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
        token,
        client_id,
        user_id,
        serializeJsonField(scopes),
        expires_at.toISOString()
    );

    return getAccessToken(token)!;
}

interface RawAccessToken {
    id: number;
    token: string;
    client_id: string;
    user_id: number | null;
    scopes: string;
    expires_at: string;
    revoked: number;
    created_at: string;
}

export function getAccessToken(token: string): OAuthAccessToken | undefined {
    const row = getStmt('SELECT * FROM oauth_access_tokens WHERE token = ? AND revoked = 0').get(token) as RawAccessToken | undefined;
    if (!row) return undefined;

    // Check if expired
    if (new Date(row.expires_at) < new Date()) {
        return undefined;
    }

    return {
        ...row,
        scopes: parseJsonField(row.scopes),
        revoked: row.revoked === 1,
    };
}

export function revokeAccessToken(token: string): boolean {
    const result = getStmt('UPDATE oauth_access_tokens SET revoked = 1 WHERE token = ?').run(token);
    return result.changes > 0;
}

export function cleanupExpiredAccessTokens(): void {
    getStmt("DELETE FROM oauth_access_tokens WHERE expires_at < datetime('now', '-7 days')").run();
}

// ============================================================================
// Refresh Token Operations
// ============================================================================

export function createRefreshToken(
    access_token_id: number,
    client_id: string,
    user_id: number,
    scopes: string[],
    expiresInSeconds = 2592000 // 30 days default
): OAuthRefreshToken {
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expires_at = new Date(Date.now() + expiresInSeconds * 1000);

    const stmt = getStmt(`
        INSERT INTO oauth_refresh_tokens (token, access_token_id, client_id, user_id, scopes, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        token,
        access_token_id,
        client_id,
        user_id,
        serializeJsonField(scopes),
        expires_at.toISOString()
    );

    return getRefreshToken(token)!;
}

interface RawRefreshToken {
    id: number;
    token: string;
    access_token_id: number;
    client_id: string;
    user_id: number;
    scopes: string;
    expires_at: string;
    revoked: number;
    created_at: string;
}

export function getRefreshToken(token: string): OAuthRefreshToken | undefined {
    const row = getStmt('SELECT * FROM oauth_refresh_tokens WHERE token = ? AND revoked = 0').get(token) as RawRefreshToken | undefined;
    if (!row) return undefined;

    // Check if expired
    if (new Date(row.expires_at) < new Date()) {
        return undefined;
    }

    return {
        ...row,
        scopes: parseJsonField(row.scopes),
        revoked: row.revoked === 1,
    };
}

export function revokeRefreshToken(token: string): boolean {
    const result = getStmt('UPDATE oauth_refresh_tokens SET revoked = 1 WHERE token = ?').run(token);
    return result.changes > 0;
}

export function cleanupExpiredRefreshTokens(): void {
    getStmt("DELETE FROM oauth_refresh_tokens WHERE expires_at < datetime('now', '-7 days')").run();
}

// ============================================================================
// User Consent Operations
// ============================================================================

export function saveUserConsent(
    user_id: number,
    client_id: string,
    scopes: string[]
): OAuthUserConsent {
    const stmt = getStmt(`
        INSERT INTO oauth_user_consents (user_id, client_id, scopes, granted_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(user_id, client_id) DO UPDATE SET
            scopes = excluded.scopes,
            updated_at = datetime('now')
    `);

    stmt.run(user_id, client_id, serializeJsonField(scopes));
    return getUserConsent(user_id, client_id)!;
}

interface RawUserConsent {
    id: number;
    user_id: number;
    client_id: string;
    scopes: string;
    granted_at: string;
    updated_at: string;
}

export function getUserConsent(user_id: number, client_id: string): OAuthUserConsent | undefined {
    const row = getStmt('SELECT * FROM oauth_user_consents WHERE user_id = ? AND client_id = ?')
        .get(user_id, client_id) as RawUserConsent | undefined;
    if (!row) return undefined;

    return {
        ...row,
        scopes: parseJsonField(row.scopes),
    };
}

export function listUserConsents(user_id: number): OAuthUserConsent[] {
    const rows = getStmt('SELECT * FROM oauth_user_consents WHERE user_id = ? ORDER BY updated_at DESC')
        .all(user_id) as RawUserConsent[];
    return rows.map(row => ({
        ...row,
        scopes: parseJsonField(row.scopes),
    }));
}

export function revokeUserConsent(user_id: number, client_id: string): boolean {
    const result = getStmt('DELETE FROM oauth_user_consents WHERE user_id = ? AND client_id = ?')
        .run(user_id, client_id);
    return result.changes > 0;
}

// ============================================================================
// Cleanup Operations
// ============================================================================

export function cleanupExpiredOAuthData(): void {
    cleanupExpiredAuthorizationCodes();
    cleanupExpiredAccessTokens();
    cleanupExpiredRefreshTokens();
}
