const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

function ensureDbDir() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function q(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function exec(sql) {
  ensureDbDir();
  execFileSync('sqlite3', [dbPath], {
    input: `PRAGMA foreign_keys=ON;\n${sql}`,
    encoding: 'utf8',
  });
}

function all(sql) {
  ensureDbDir();
  const out = execFileSync('sqlite3', ['-json', dbPath, `PRAGMA foreign_keys=ON; ${sql}`], {
    encoding: 'utf8',
  });
  return out.trim() ? JSON.parse(out) : [];
}

function one(sql) {
  return all(sql)[0] || null;
}

module.exports = { dbPath, exec, all, one, q };
