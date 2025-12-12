import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { createSession, getSessionWithUser, deleteSession, getUserByUsername, createUser, getUserCount, updateUserPassword } from './db';
import { getConfig, saveConfig } from './config';

const SALT_ROUNDS = 10;
const SESSION_COOKIE = 'atom_session';

// Password utilities
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Auth utilities
export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    const user = getUserByUsername(username);

    if (!user) {
        return { success: false, error: 'Invalid credentials' };
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        return { success: false, error: 'Invalid credentials' };
    }

    // Create session
    const session = createSession(user.id);

    // Set cookie
    // Only use secure cookies if explicitly enabled via COOKIE_SECURE env var
    // This allows HTTP access in Docker while supporting HTTPS when configured
    const cookieStore = await cookies();
    const isSecure = process.env.COOKIE_SECURE === 'true';
    cookieStore.set(SESSION_COOKIE, session.id, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        expires: new Date(session.expires_at),
        path: '/',
    });

    return { success: true };
}

export async function logout(): Promise<void> {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    if (sessionId) {
        deleteSession(sessionId);
        cookieStore.delete(SESSION_COOKIE);
    }
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

    if (!sessionId) return null;

    const session = getSessionWithUser(sessionId);
    if (!session) return null;

    return {
        id: session.user.id,
        username: session.user.username,
    };
}

export async function register(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    // Hash password first (before DB check to prevent timing attacks)
    const hash = await hashPassword(password);

    try {
        // createUser will throw if username exists (prevents race condition)
        const user = createUser(username, hash);

        // Auto-login after registration
        const session = createSession(user.id);

        const cookieStore = await cookies();
        const isSecure = process.env.COOKIE_SECURE === 'true';
        cookieStore.set(SESSION_COOKIE, session.id, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            expires: new Date(session.expires_at),
            path: '/',
        });

        // Sync config name with username
        try {
            const config = await getConfig();
            if (config) {
                config.user = { ...config.user, name: username };
                await saveConfig(config);
            }
        } catch (err) {
            console.error('Failed to sync config username:', err);
            // Don't fail registration if config update fails
        }

        return { success: true };
    } catch (error: unknown) {
        // Handle unique constraint violation (username already exists)
        const isUniqueConstraint = error instanceof Error &&
            (error.message === 'Username already exists' ||
                ('code' in error && (error as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'));

        if (isUniqueConstraint) {
            return { success: false, error: 'Username already exists' };
        }
        throw error; // Re-throw unexpected errors
    }
}

export function needsOnboarding(): boolean {
    return getUserCount() === 0;
}

export async function resetPassword(username: string, newPassword: string): Promise<boolean> {
    const user = getUserByUsername(username);
    if (!user) return false;

    const hash = await hashPassword(newPassword);
    updateUserPassword(user.id, hash);
    return true;
}
