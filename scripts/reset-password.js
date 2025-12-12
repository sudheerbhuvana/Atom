#!/usr/bin/env node

/**
 * Password Reset Script for Docker
 * Usage: node scripts/reset-password.js <username> <new-password>
 * Or: docker exec -it atom node scripts/reset-password.js <username> <new-password>
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'atom.db');

async function main() {
    const [, , username, newPassword] = process.argv;

    if (!username || !newPassword) {
        console.log('Usage: node scripts/reset-password.js <username> <new-password>');
        console.log('');
        console.log('Example:');
        console.log('  docker exec -it atom node scripts/reset-password.js admin newpass123');
        process.exit(1);
    }

    try {
        const db = new Database(DB_PATH);

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            console.error(`Error: User "${username}" not found.`);
            console.log('');
            console.log('Available users:');
            const users = db.prepare('SELECT username FROM users').all();
            users.forEach(u => console.log(`  - ${u.username}`));
            process.exit(1);
        }

        // Hash new password
        const hash = await bcrypt.hash(newPassword, 10);

        // Update password
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

        // Clear all sessions for this user
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

        console.log(`✓ Password reset for "${username}"`);
        console.log('✓ All sessions cleared - user must log in again');

        db.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
