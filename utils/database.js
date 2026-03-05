/**
 * Database — SQLite setup via better-sqlite3
 * Single file: data/memoireai.db
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'memoireai.db');
const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ SCHEMA ============

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT,
    profile_picture TEXT DEFAULT '',
    credits INTEGER DEFAULT 50,
    is_premium INTEGER DEFAULT 0,
    has_payment_method INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    credits_changed INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    mindmap_data TEXT,
    memoir_data TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    url TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    content TEXT DEFAULT '',
    relevance_score INTEGER DEFAULT 0,
    related_nodes TEXT DEFAULT '[]',
    added_at TEXT NOT NULL,
    type TEXT DEFAULT 'web',
    key_findings TEXT DEFAULT '[]',
    methodology TEXT DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`);

// Quick migration for existing databases
const usersInfo = db.prepare("PRAGMA table_info(users)").all();
const hasCredits = usersInfo.some(c => c.name === 'credits');
if (!hasCredits) {
    db.exec(`
        ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 50;
        ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0;
    `);
}
const hasPmt = usersInfo.some(c => c.name === 'has_payment_method');
if (!hasPmt) {
    db.exec(`ALTER TABLE users ADD COLUMN has_payment_method INTEGER DEFAULT 0;`);
}

// Ensure transactions table exists for older databases
db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        credits_changed INTEGER NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
`);

module.exports = db;