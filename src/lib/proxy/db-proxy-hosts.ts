import db from '../db';

export interface ProxyHost {
    id: string;
    domain: string;
    targetPort: number;
    ssl: boolean;
    letsencrypt: boolean;
    created_at?: string;
    updated_at?: string;
}

/**
 * List all Proxy Hosts
 */
export function listProxyHosts(): ProxyHost[] {
    const rows = db.prepare('SELECT * FROM proxy_hosts ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
        ...row,
        ssl: row.ssl === 1,
        letsencrypt: row.letsencrypt === 1
    }));
}

/**
 * Create Proxy Host
 */
export function createProxyHost(domain: string, targetPort: number, ssl: boolean, letsencrypt = false): ProxyHost {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
        INSERT INTO proxy_hosts (id, domain, targetPort, ssl, letsencrypt)
        VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, domain, targetPort, ssl ? 1 : 0, letsencrypt ? 1 : 0);

    return getProxyHostById(id)!;
}

/**
 * Get Proxy Host by ID
 */
export function getProxyHostById(id: string): ProxyHost | undefined {
    const row = db.prepare('SELECT * FROM proxy_hosts WHERE id = ?').get(id) as any;
    if (!row) return undefined;

    return {
        ...row,
        ssl: row.ssl === 1,
        letsencrypt: row.letsencrypt === 1
    };
}

/**
 * Delete Proxy Host
 */
export function deleteProxyHost(id: string): boolean {
    const result = db.prepare('DELETE FROM proxy_hosts WHERE id = ?').run(id);
    return result.changes > 0;
}
