import db from '../db';
import type { ProtectedApplication } from './types';

import Database from 'better-sqlite3';

// Helper to get or create prepared statement
const preparedStmts = new Map<string, Database.Statement>();

function getStmt(sql: string): Database.Statement {
    if (!preparedStmts.has(sql)) {
        preparedStmts.set(sql, db.prepare(sql));
    }
    return preparedStmts.get(sql)!;
}

// Helper to parse JSON fields
function parseJsonField<T>(data: string | null): T | null {
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

// Helper to serialize JSON fields
function serializeJsonField<T>(data: T): string {
    return JSON.stringify(data);
}

/**
 * Create Protected Application
 */
export function createProtectedApplication(
    name: string,
    slug: string,
    backend_url: string,
    require_auth = true,
    allowed_users: string[] | null = null,
    inject_headers = true,
    strip_auth_header = true
): ProtectedApplication {
    const stmt = getStmt(`
        INSERT INTO protected_applications 
        (name, slug, backend_url, require_auth, allowed_users, inject_headers, strip_auth_header)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        name,
        slug,
        backend_url,
        require_auth ? 1 : 0,
        allowed_users ? serializeJsonField(allowed_users) : null,
        inject_headers ? 1 : 0,
        strip_auth_header ? 1 : 0
    );

    return getProtectedApplicationBySlug(slug)!;
}

/**
 * Get Protected Application by slug
 */
interface RawProtectedApplication {
    id: number;
    name: string;
    slug: string;
    backend_url: string;
    require_auth: number; // SQLite boolean
    allowed_users: string | null; // SQLite JSON
    inject_headers: number; // SQLite boolean
    strip_auth_header: number; // SQLite boolean
    created_at: string;
    updated_at: string;
}

/**
 * Get Protected Application by slug
 */
export function getProtectedApplicationBySlug(slug: string): ProtectedApplication | undefined {
    const row = getStmt('SELECT * FROM protected_applications WHERE slug = ?').get(slug) as RawProtectedApplication | undefined;
    if (!row) return undefined;

    return {
        ...row,
        require_auth: row.require_auth === 1,
        allowed_users: parseJsonField(row.allowed_users),
        inject_headers: row.inject_headers === 1,
        strip_auth_header: row.strip_auth_header === 1,
    };
}

/**
 * Get Protected Application by ID
 */
export function getProtectedApplicationById(id: number): ProtectedApplication | undefined {
    const row = getStmt('SELECT * FROM protected_applications WHERE id = ?').get(id) as RawProtectedApplication | undefined;
    if (!row) return undefined;

    return {
        ...row,
        require_auth: row.require_auth === 1,
        allowed_users: parseJsonField(row.allowed_users),
        inject_headers: row.inject_headers === 1,
        strip_auth_header: row.strip_auth_header === 1,
    };
}

/**
 * List all Protected Applications
 */
export function listProtectedApplications(): ProtectedApplication[] {
    const rows = getStmt('SELECT * FROM protected_applications ORDER BY created_at DESC').all() as RawProtectedApplication[];
    return rows.map(row => ({
        ...row,
        require_auth: row.require_auth === 1,
        allowed_users: parseJsonField(row.allowed_users),
        inject_headers: row.inject_headers === 1,
        strip_auth_header: row.strip_auth_header === 1,
    }));
}

/**
 * Update Protected Application
 */
export function updateProtectedApplication(
    slug: string,
    updates: {
        name?: string;
        backend_url?: string;
        require_auth?: boolean;
        allowed_users?: string[] | null;
        inject_headers?: boolean;
        strip_auth_header?: boolean;
    }
): boolean {
    const app = getProtectedApplicationBySlug(slug);
    if (!app) return false;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
    }
    if (updates.backend_url !== undefined) {
        fields.push('backend_url = ?');
        values.push(updates.backend_url);
    }
    if (updates.require_auth !== undefined) {
        fields.push('require_auth = ?');
        values.push(updates.require_auth ? 1 : 0);
    }
    if (updates.allowed_users !== undefined) {
        fields.push('allowed_users = ?');
        values.push(updates.allowed_users ? serializeJsonField(updates.allowed_users) : null);
    }
    if (updates.inject_headers !== undefined) {
        fields.push('inject_headers = ?');
        values.push(updates.inject_headers ? 1 : 0);
    }
    if (updates.strip_auth_header !== undefined) {
        fields.push('strip_auth_header = ?');
        values.push(updates.strip_auth_header ? 1 : 0);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    values.push(slug);

    const sql = `UPDATE protected_applications SET ${fields.join(', ')} WHERE slug = ?`;
    db.prepare(sql).run(...values);
    return true;
}

/**
 * Delete Protected Application
 */
export function deleteProtectedApplication(slug: string): boolean {
    const result = getStmt('DELETE FROM protected_applications WHERE slug = ?').run(slug);
    return result.changes > 0;
}
