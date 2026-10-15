const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '../../data/credits.db');
console.log('Migrating database at:', dbPath);

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    canonical_user_id TEXT NOT NULL,
    phone TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_canonical ON user_sessions(canonical_user_id);
`);

db.prepare(`
  UPDATE user_credits 
  SET daily_credit_limit = 2, 
      credits_remaining = MAX(0, 2 - credits_used)
`).run();

console.log('Updated user credits rows:');
console.log(db.prepare('SELECT user_id, daily_credit_limit, credits_used, credits_remaining FROM user_credits').all());
