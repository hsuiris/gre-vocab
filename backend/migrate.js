const fs = require('fs');
const path = require('path');
const { exec, one, q, dbPath } = require('./db');

const dir = path.join(__dirname, '..', 'migrations');

exec('CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (one(`SELECT id FROM migrations WHERE id = ${q(file)};`)) continue;
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  exec(`BEGIN;\n${sql}\nINSERT INTO migrations (id) VALUES (${q(file)});\nCOMMIT;`);
  console.log(`applied ${file}`);
}

console.log(`database ready: ${dbPath}`);
