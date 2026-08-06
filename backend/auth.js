const crypto = require('crypto');
const { q, one, exec } = require('./db');

const TOKEN_TTL_DAYS = 30;

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400000).toISOString();
  exec(`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
        VALUES (${q(id('sess'))}, ${q(userId)}, ${q(hashToken(token))}, ${q(expires)}, ${q(now())});`);
  return token;
}

function currentUser(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return null;
  return one(`SELECT u.id, u.email, u.role
              FROM sessions s
              JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ${q(hashToken(match[1]))}
                AND s.expires_at > ${q(now())}
                AND u.deleted_at IS NULL;`);
}

function requireUser(req) {
  const user = currentUser(req);
  if (!user) {
    const error = new Error('未登入或登入已過期');
    error.status = 401;
    throw error;
  }
  return user;
}

function requireAdmin(req) {
  const user = requireUser(req);
  if (user.role !== 'admin') {
    const error = new Error('沒有管理權限');
    error.status = 403;
    throw error;
  }
  return user;
}

module.exports = { now, id, hashPassword, hashToken, createSession, requireUser, requireAdmin };
