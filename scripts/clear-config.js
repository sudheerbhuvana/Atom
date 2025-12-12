/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.join(DATA_DIR, 'atom.db');

const db = new Database(DB_PATH);
db.prepare('DELETE FROM config').run();
console.log('Config table cleared');
