import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use /data in Docker, ./data locally
const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'atom.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Singleton pattern for Next.js hot reload
const globalWithDb = global as typeof globalThis & {
    _db?: Database.Database;
    _preparedStmts?: Map<string, Database.Statement>;
};

if (!globalWithDb._db) {
    globalWithDb._db = new Database(DB_PATH);
    globalWithDb._preparedStmts = new Map();
}

const db = globalWithDb._db;
let preparedStmts = globalWithDb._preparedStmts || new Map();

if (!globalWithDb._preparedStmts) {
    globalWithDb._preparedStmts = preparedStmts;
}

// Helper to get or create prepared statement
function getStmt(sql: string): Database.Statement {
    if (!preparedStmts || !preparedStmts.has(sql)) {
        if (!preparedStmts) {
            preparedStmts = new Map();
            globalWithDb._preparedStmts = preparedStmts;
        }
        preparedStmts.set(sql, db.prepare(sql));
    }
    return preparedStmts.get(sql)!;
}

// Initialize tables from schema file
try {
    // Try multiple potential locations for schema file (dev vs standalone builds)
    const possiblePaths = [
        path.join(process.cwd(), 'src', 'lib', 'schema.sql'),  // Dev mode
        path.join(process.cwd(), 'schema.sql'),                 // Standalone root
        path.join(__dirname, 'schema.sql'),                     // Same directory as db.ts
    ];

    let schemaPath: string | null = null;
    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            schemaPath = testPath;
            break;
        }
    }

    if (!schemaPath) {
        throw new Error('Could not find schema.sql file in any expected location');
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Auto-migration: Check for new columns in existing tables
    try {
        const userColumns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];

        // Add 'tags' column if missing
        if (!userColumns.some(c => c.name === 'tags')) {
            console.log('Migrating database: Adding tags column to users table...');
            db.prepare('ALTER TABLE users ADD COLUMN tags TEXT').run();
        }

        // Add 'email' column if missing (legacy support)
        if (!userColumns.some(c => c.name === 'email')) {
            console.log('Migrating database: Adding email column to users table...');
            db.prepare('ALTER TABLE users ADD COLUMN email TEXT').run();
        }

        // Add 'role' column if missing
        if (!userColumns.some(c => c.name === 'role')) {
            console.log('Migrating database: Adding role column to users table...');
            db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'").run();

            // Set ID 1 and special users to admin
            db.prepare("UPDATE users SET role = 'admin' WHERE id = 1 OR username = 'admin' OR username = 'VishnuByrraju'").run();
        }

    } catch (migErr) {
        console.error('Auto-migration error:', migErr);
    }

    // Also load OAuth2 schema
    const oauthPossiblePaths = [
        path.join(process.cwd(), 'src', 'lib', 'schema_oauth.sql'),
        path.join(process.cwd(), 'schema_oauth.sql'),
        path.join(__dirname, 'schema_oauth.sql'),
    ];

    let oauthSchemaPath: string | null = null;
    for (const testPath of oauthPossiblePaths) {
        if (fs.existsSync(testPath)) {
            oauthSchemaPath = testPath;
            break;
        }
    }

    if (oauthSchemaPath) {
        const oauthSchema = fs.readFileSync(oauthSchemaPath, 'utf8');
        db.exec(oauthSchema);
    } else {
        console.warn('OAuth2 schema file not found - OAuth features will not be available');
    }

    // Load Federated Auth schema
    const federatedPossiblePaths = [
        path.join(process.cwd(), 'src', 'lib', 'schema_federated.sql'),
        path.join(process.cwd(), 'schema_federated.sql'),
        path.join(__dirname, 'schema_federated.sql'),
    ];

    let federatedSchemaPath: string | null = null;
    for (const testPath of federatedPossiblePaths) {
        if (fs.existsSync(testPath)) {
            federatedSchemaPath = testPath;
            break;
        }
    }

    if (federatedSchemaPath) {
        const fedSchema = fs.readFileSync(federatedSchemaPath, 'utf8');
        db.exec(fedSchema);

        // Auto-migration for auth_providers new columns
        // This runs on every startup to ensure backward compatibility
        try {
            // Check if table exists first
            const tableExists = db.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='auth_providers'"
            ).get();

            if (tableExists) {
                const authProviderColumns = db.prepare('PRAGMA table_info(auth_providers)').all() as { name: string }[];
                const existingColumnNames = authProviderColumns.map(c => c.name);

                console.log('Checking auth_providers schema...');

                // Add user_match_field if missing
                if (!existingColumnNames.includes('user_match_field')) {
                    console.log('✓ Migrating database: Adding user_match_field to auth_providers...');
                    db.prepare("ALTER TABLE auth_providers ADD COLUMN user_match_field TEXT DEFAULT 'email'").run();
                }

                // Add auto_register if missing
                if (!existingColumnNames.includes('auto_register')) {
                    console.log('✓ Migrating database: Adding auto_register to auth_providers...');
                    db.prepare('ALTER TABLE auth_providers ADD COLUMN auto_register INTEGER DEFAULT 1').run();
                }

                // Add auto_launch if missing
                if (!existingColumnNames.includes('auto_launch')) {
                    console.log('✓ Migrating database: Adding auto_launch to auth_providers...');
                    db.prepare('ALTER TABLE auth_providers ADD COLUMN auto_launch INTEGER DEFAULT 0').run();
                }

                console.log('✓ auth_providers schema migration complete');
            }
        } catch (migErr) {
            console.error('❌ Auth provider migration error:', migErr);
            // Don't throw - allow app to continue even if migration fails
        }
    } else {
        console.warn('Federated Auth schema file not found');
    }
} catch (error) {
    console.error('Failed to initialize database schema:', error);
    // Re-throw in production to fail fast, but allow dev to continue
    if (process.env.NODE_ENV === 'production') {
        throw error;
    }
}

export interface User {
    id: number;
    username: string;
    password_hash: string;
    email?: string;
    tags?: string[];
    role: 'admin' | 'member';
    created_at: string;
}

export interface Session {
    id: string;
    user_id: number;
    expires_at: string;
    created_at: string;
}

// Helper to parse user tags and role
function parseUser(user: any): User | undefined {
    if (!user) return undefined;
    return {
        ...user,
        tags: user.tags ? user.tags.split(',') : [],
        role: user.role || 'member'
    };
}

// User operations
export function getUserByEmail(email: string): User | undefined {
    const user = getStmt('SELECT * FROM users WHERE email = ?').get(email);
    return parseUser(user);
}

export function getUserByUsername(username: string): User | undefined {
    const user = getStmt('SELECT * FROM users WHERE username = ?').get(username);
    return parseUser(user);
}

export function getUserById(id: number): User | undefined {
    const user = getStmt('SELECT * FROM users WHERE id = ?').get(id);
    return parseUser(user);
}

export function createUser(username: string, passwordHash: string, email?: string, tags?: string[], role: 'admin' | 'member' = 'member'): User {
    // Use INSERT OR IGNORE to prevent raise conditions
    const tagsStr = tags ? tags.join(',') : null;
    const stmt = getStmt('INSERT INTO users (username, password_hash, email, tags, role) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(username, passwordHash, email || null, tagsStr, role);

    // Check if insert was successful (SQLite returns changes > 0)
    if (result.changes === 0) {
        throw new Error('Username already exists');
    }

    return getUserById(result.lastInsertRowid as number)!;
}

export function getUserCount(): number {
    const result = getStmt('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
}

export function updateUserPassword(userId: number, passwordHash: string): void {
    getStmt('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}
export function updateUserRole(userId: number, role: 'admin' | 'member'): void {
    getStmt('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
}
export function updateUserTags(userId: number, tags: string[]): void {
    const tagsStr = tags.join(',');
    getStmt('UPDATE users SET tags = ? WHERE id = ?').run(tagsStr, userId);
}

export function getAllUsers(): User[] {
    const users = getStmt('SELECT id, username, password_hash, email, tags, role, created_at FROM users').all();
    return users.map((u: any) => ({
        ...u,
        tags: u.tags ? u.tags.split(',') : [],
        role: u.role || 'member'
    }));
}

// Safe version that doesn't return password hashes
export function getAllUsersSafe(): Omit<User, 'password_hash'>[] {
    const users = getStmt('SELECT id, username, email, tags, role, created_at FROM users').all();
    return users.map((u: any) => ({
        ...u,
        tags: u.tags ? u.tags.split(',') : [],
        role: u.role || 'member'
    }));
}

export function deleteUser(id: number): void {
    const deleteSessionsStmt = getStmt('DELETE FROM sessions WHERE user_id = ?');
    const deleteUserStmt = getStmt('DELETE FROM users WHERE id = ?');

    const transaction = db.transaction(() => {
        deleteSessionsStmt.run(id);
        deleteUserStmt.run(id);
    });

    transaction();
}

// Session operations
export function createSession(userId: number): Session {
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    getStmt('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .run(id, userId, expiresAt.toISOString());

    return getSession(id)!;
}

export function getSession(id: string): Session | undefined {
    return getStmt('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

// Session cleanup counter (more efficient than Math.random())
let sessionCheckCount = 0;
const SESSION_CLEANUP_INTERVAL = 100; // Cleanup every 100 session checks

export function getSessionWithUser(id: string): (Session & { user: User }) | undefined {
    const session = getSession(id);
    if (!session) return undefined;

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
        deleteSession(id);
        return undefined;
    }

    const user = getUserById(session.user_id);
    if (!user) return undefined;

    // Periodic cleanup of expired sessions (more efficient than random)
    sessionCheckCount++;
    if (sessionCheckCount >= SESSION_CLEANUP_INTERVAL) {
        sessionCheckCount = 0;
        cleanupExpiredSessions();
    }

    return { ...session, user };
}

export function deleteSession(id: string): void {
    getStmt('DELETE FROM sessions WHERE id = ?').run(id);
}

export function deleteAllUserSessions(userId: number): void {
    getStmt('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// Cleanup expired sessions
export function cleanupExpiredSessions(): void {
    getStmt("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// Config operations
export function getConfig(): object | null {
    const row = getStmt('SELECT data FROM config WHERE id = 1').get() as { data: string } | undefined;
    if (!row) return null;
    try {
        return JSON.parse(row.data);
    } catch {
        return null;
    }
}

export function saveConfig(config: object): void {
    const data = JSON.stringify(config);
    // Use INSERT OR REPLACE for atomic upsert (more efficient than SELECT then INSERT/UPDATE)
    getStmt("INSERT OR REPLACE INTO config (id, data, updated_at) VALUES (1, ?, datetime('now'))").run(data);
}

export function hasConfig(): boolean {
    const row = getStmt('SELECT id FROM config WHERE id = 1').get();
    return !!row;
}

export default db;
