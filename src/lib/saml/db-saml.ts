import db from '../db';
import type { SAMLServiceProvider } from './types';

// Helper to get or create prepared statement
const preparedStmts = new Map<string, any>();

function getStmt(sql: string): any {
    if (!preparedStmts.has(sql)) {
        preparedStmts.set(sql, db.prepare(sql));
    }
    return preparedStmts.get(sql)!;
}

// Helper to parse JSON fields
function parseJsonField<T>(data: string | null): T {
    if (!data) return {} as T;
    try {
        return JSON.parse(data);
    } catch {
        return {} as T;
    }
}

// Helper to serialize JSON fields
function serializeJsonField<T>(data: T): string {
    return JSON.stringify(data);
}

/**
 * Create SAML Service Provider
 */
export function createSAMLServiceProvider(
    entity_id: string,
    name: string,
    acs_url: string,
    description?: string,
    metadata_url?: string,
    sp_certificate?: string,
    attribute_mapping: Record<string, string> = {},
    sign_assertions = true,
    encrypt_assertions = false
): SAMLServiceProvider {
    const stmt = getStmt(`
        INSERT INTO saml_service_providers 
        (entity_id, name, description, acs_url, metadata_url, sp_certificate, attribute_mapping, sign_assertions, encrypt_assertions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        entity_id,
        name,
        description || null,
        acs_url,
        metadata_url || null,
        sp_certificate || null,
        serializeJsonField(attribute_mapping),
        sign_assertions ? 1 : 0,
        encrypt_assertions ? 1 : 0
    );

    return getSAMLServiceProviderByEntityId(entity_id)!;
}

/**
 * Get SAML Service Provider by Entity ID
 */
export function getSAMLServiceProviderByEntityId(entity_id: string): SAMLServiceProvider | undefined {
    const row = getStmt('SELECT * FROM saml_service_providers WHERE entity_id = ?').get(entity_id) as any;
    if (!row) return undefined;

    return {
        ...row,
        attribute_mapping: parseJsonField(row.attribute_mapping),
        sign_assertions: row.sign_assertions === 1,
        encrypt_assertions: row.encrypt_assertions === 1,
    };
}

/**
 * Get SAML Service Provider by ID
 */
export function getSAMLServiceProviderById(id: number): SAMLServiceProvider | undefined {
    const row = getStmt('SELECT * FROM saml_service_providers WHERE id = ?').get(id) as any;
    if (!row) return undefined;

    return {
        ...row,
        attribute_mapping: parseJsonField(row.attribute_mapping),
        sign_assertions: row.sign_assertions === 1,
        encrypt_assertions: row.encrypt_assertions === 1,
    };
}

/**
 * List all SAML Service Providers
 */
export function listSAMLServiceProviders(): SAMLServiceProvider[] {
    const rows = getStmt('SELECT * FROM saml_service_providers ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
        ...row,
        attribute_mapping: parseJsonField(row.attribute_mapping),
        sign_assertions: row.sign_assertions === 1,
        encrypt_assertions: row.encrypt_assertions === 1,
    }));
}

/**
 * Update SAML Service Provider
 */
export function updateSAMLServiceProvider(
    entity_id: string,
    updates: {
        name?: string;
        description?: string;
        acs_url?: string;
        metadata_url?: string;
        sp_certificate?: string;
        attribute_mapping?: Record<string, string>;
        sign_assertions?: boolean;
        encrypt_assertions?: boolean;
    }
): boolean {
    const sp = getSAMLServiceProviderByEntityId(entity_id);
    if (!sp) return false;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
    }
    if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
    }
    if (updates.acs_url !== undefined) {
        fields.push('acs_url = ?');
        values.push(updates.acs_url);
    }
    if (updates.metadata_url !== undefined) {
        fields.push('metadata_url = ?');
        values.push(updates.metadata_url);
    }
    if (updates.sp_certificate !== undefined) {
        fields.push('sp_certificate = ?');
        values.push(updates.sp_certificate);
    }
    if (updates.attribute_mapping !== undefined) {
        fields.push('attribute_mapping = ?');
        values.push(serializeJsonField(updates.attribute_mapping));
    }
    if (updates.sign_assertions !== undefined) {
        fields.push('sign_assertions = ?');
        values.push(updates.sign_assertions ? 1 : 0);
    }
    if (updates.encrypt_assertions !== undefined) {
        fields.push('encrypt_assertions = ?');
        values.push(updates.encrypt_assertions ? 1 : 0);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = datetime('now')");
    values.push(entity_id);

    const sql = `UPDATE saml_service_providers SET ${fields.join(', ')} WHERE entity_id = ?`;
    db.prepare(sql).run(...values);
    return true;
}

/**
 * Delete SAML Service Provider
 */
export function deleteSAMLServiceProvider(entity_id: string): boolean {
    const result = getStmt('DELETE FROM saml_service_providers WHERE entity_id = ?').run(entity_id);
    return result.changes > 0;
}
