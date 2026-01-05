const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'atom.db');

if (!fs.existsSync(DB_PATH)) {
    console.error('Database not found at ' + DB_PATH);
    process.exit(1);
}

const db = new Database(DB_PATH);

try {
    console.log('Attempting to add tags column...');
    db.prepare('ALTER TABLE users ADD COLUMN tags TEXT').run();
    console.log('Successfully added tags column to users table');
} catch (error) {
    if (error.message.includes('duplicate column name')) {
        console.log('Column tags already exists');
    } else {
        console.error('Error adding column:', error);
        process.exit(1);
    }
}
