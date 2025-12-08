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
};

let db: Database.Database;

if (!globalWithDb._db) {
    globalWithDb._db = new Database(DB_PATH);
}
db = globalWithDb._db;

// Initialize tables
// Initialize tables from schema file
try {
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
} catch (error) {
    console.error('Failed to initialize database schema:', error);
    // Fallback or re-throw depending on severity. For now, log.
}

export interface User {
    id: number;
    username: string;
    password_hash: string;
    created_at: string;
}

export interface Session {
    id: string;
    user_id: number;
    expires_at: string;
    created_at: string;
}

// User operations
export function getUserByUsername(username: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export function getUserById(id: number): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(username: string, passwordHash: string): User {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, passwordHash);
    return getUserById(result.lastInsertRowid as number)!;
}

export function getUserCount(): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
}

export function updateUserPassword(userId: number, passwordHash: string): void {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

export function getAllUsers(): User[] {
    return db.prepare('SELECT id, username, password_hash, created_at FROM users').all() as User[];
}

export function deleteUser(id: number): void {
    const deleteSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');

    const transaction = db.transaction(() => {
        deleteSessions.run(id);
        deleteUser.run(id);
    });

    transaction();
}

// Session operations
export function createSession(userId: number): Session {
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .run(id, userId, expiresAt.toISOString());

    return getSession(id)!;
}

export function getSession(id: string): Session | undefined {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

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

    return { ...session, user };
}

export function deleteSession(id: string): void {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function deleteAllUserSessions(userId: number): void {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// Cleanup expired sessions
export function cleanupExpiredSessions(): void {
    db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// Config operations
export function getConfig(): object | null {
    const row = db.prepare('SELECT data FROM config WHERE id = 1').get() as { data: string } | undefined;
    if (!row) return null;
    try {
        return JSON.parse(row.data);
    } catch {
        return null;
    }
}

export function saveConfig(config: object): void {
    const data = JSON.stringify(config);
    const existing = db.prepare('SELECT id FROM config WHERE id = 1').get();

    if (existing) {
        db.prepare("UPDATE config SET data = ?, updated_at = datetime('now') WHERE id = 1").run(data);
    } else {
        db.prepare('INSERT INTO config (id, data) VALUES (1, ?)').run(data);
    }
}

export function hasConfig(): boolean {
    const row = db.prepare('SELECT id FROM config WHERE id = 1').get();
    return !!row;
}

export default db;
