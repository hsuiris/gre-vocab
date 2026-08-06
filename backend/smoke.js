const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gre-vocab-api-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

require('./migrate');
const { q, exec, one } = require('./db');
const { createUser } = require('./users');
const { createServer } = require('./server');

function request(base, method, path, body, token) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({ status: res.status, body: await res.json() }));
}

function htmlRequest(base, path) {
  return fetch(`${base}${path}`).then(async (res) => ({ status: res.status, text: await res.text() }));
}

(async () => {
  exec(`INSERT INTO words (id, word, meaning, created_at, updated_at)
        VALUES ('word_test', 'abate', '減輕', '2026-07-19T00:00:00.000Z', '2026-07-19T00:00:00.000Z');`);
  createUser({ email: 'admin@example.com', password: 'password123', displayName: 'Admin', role: 'admin' });

  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const adminPage = await htmlRequest(base, '/admin');
  assert.equal(adminPage.status, 200);
  assert.ok(adminPage.text.includes('GRE單字後台'));

  const registered = await request(base, 'POST', '/api/auth/register', {
    email: 'user@example.com',
    password: 'password123',
    displayName: 'Iris',
  });
  assert.equal(registered.status, 201);
  assert.ok(registered.body.token);

  const duplicateRegister = await request(base, 'POST', '/api/auth/register', {
    email: 'user@example.com',
    password: 'different123',
    displayName: 'Taken',
  });
  assert.equal(duplicateRegister.status, 409);

  const denied = await request(base, 'PATCH', '/api/me/profile', { displayName: 'Nope' });
  assert.equal(denied.status, 401);

  const updated = await request(base, 'PATCH', '/api/me/profile', {
    displayName: 'Iris GRE',
    avatarUrl: 'https://example.com/avatar.png',
    goalText: '每天 30 個單字',
  }, registered.body.token);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.profile.displayName, 'Iris GRE');

  const badOtherUserMutation = await request(base, 'PATCH', '/api/me/profile', {
    userId: 'someone_else',
    displayName: 'Still Iris',
  }, registered.body.token);
  assert.equal(badOtherUserMutation.status, 200);
  assert.equal(one(`SELECT display_name FROM profiles WHERE user_id = ${q(registered.body.user.id)};`).display_name, 'Still Iris');

  const adminLogin = await request(base, 'POST', '/api/auth/login', {
    email: 'admin@example.com',
    password: 'password123',
  });
  assert.equal(adminLogin.status, 200);

  const userCannotAdmin = await request(base, 'POST', '/api/admin/words', {
    word: 'cogent',
    meaning: '有說服力的',
  }, registered.body.token);
  assert.equal(userCannotAdmin.status, 403);

  const adminWord = await request(base, 'POST', '/api/admin/words', {
    word: 'cogent',
    meaning: '有說服力的',
    example: 'A cogent argument wins.',
  }, adminLogin.body.token);
  assert.equal(adminWord.status, 201);

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('backend tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
