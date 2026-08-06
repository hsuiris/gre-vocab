const { q, one, exec } = require('./db');
const { now, id, hashPassword } = require('./auth');
const { cleanEmail, assertEmail, assertPassword, assertDisplayName } = require('./validators');

function createUser({ email, password, displayName, role = 'user', allowExisting = false }) {
  const clean = cleanEmail(email);
  const name = (displayName || clean.split('@')[0] || 'User').trim();
  assertEmail(clean);
  assertPassword(password);
  assertDisplayName(name);
  const existing = one(`SELECT id FROM users WHERE email = ${q(clean)};`);
  if (existing && allowExisting) return existing;
  if (existing) {
    const error = new Error('Email 已被註冊');
    error.status = 409;
    throw error;
  }
  const userId = id('usr');
  const passwordData = hashPassword(password);
  const ts = now();
  exec(`BEGIN;
        INSERT INTO users (id, email, password_hash, password_salt, role, created_at, updated_at)
        VALUES (${q(userId)}, ${q(clean)}, ${q(passwordData.hash)}, ${q(passwordData.salt)}, ${q(role)}, ${q(ts)}, ${q(ts)});
        INSERT INTO profiles (user_id, display_name, created_at, updated_at)
        VALUES (${q(userId)}, ${q(name)}, ${q(ts)}, ${q(ts)});
        INSERT INTO user_settings (user_id, created_at, updated_at)
        VALUES (${q(userId)}, ${q(ts)}, ${q(ts)});
        COMMIT;`);
  return { id: userId };
}

module.exports = { createUser };
