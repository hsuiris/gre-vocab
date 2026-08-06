const http = require('http');
const { URL } = require('url');
const { q, one, all, exec } = require('./db');
const { now, id, hashPassword, createSession, hashToken, requireUser, requireAdmin } = require('./auth');
const { createUser } = require('./users');
const { cleanEmail, assertEmail, assertPassword, assertDisplayName, assertAvatarUrl, assertGoal, bad } = require('./validators');

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendHtml(res, html) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw bad('JSON 格式不正確');
  }
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

function getProfile(userId) {
  return one(`SELECT display_name AS displayName, avatar_url AS avatarUrl, goal_text AS goalText, goal_type AS goalType, goal_json AS goalJson
              FROM profiles WHERE user_id = ${q(userId)};`);
}

function getSettings(userId) {
  return one(`SELECT auto_show_details AS autoShowDetails,
                     auto_show_choice_answers AS autoShowChoiceAnswers,
                     review_notifications AS reviewNotifications,
                     streak_notifications AS streakNotifications
              FROM user_settings WHERE user_id = ${q(userId)};`);
}

function authPayload(user, token) {
  return { token, user: publicUser(user), profile: getProfile(user.id), settings: getSettings(user.id) };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const method = req.method || 'GET';

  if (method === 'GET' && path === '/health') return send(res, 200, { ok: true });
  if (method === 'GET' && path === '/admin') return sendHtml(res, adminHtml());

  if (method === 'POST' && path === '/api/auth/register') {
    const body = await readJson(req);
    const email = cleanEmail(body.email);
    assertEmail(email);
    assertPassword(body.password);
    const displayName = body.displayName || email.split('@')[0];
    const created = createUser({ email, password: body.password, displayName });
    const user = one(`SELECT id, email, role FROM users WHERE id = ${q(created.id)};`);
    return send(res, 201, authPayload(user, createSession(user.id)));
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await readJson(req);
    const email = cleanEmail(body.email);
    assertEmail(email);
    assertPassword(body.password);
    const user = one(`SELECT id, email, role, password_hash, password_salt FROM users WHERE email = ${q(email)} AND deleted_at IS NULL;`);
    if (!user || hashPassword(body.password, user.password_salt).hash !== user.password_hash) {
      const error = new Error('Email 或密碼錯誤');
      error.status = 401;
      throw error;
    }
    return send(res, 200, authPayload(user, createSession(user.id)));
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    requireUser(req);
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    exec(`DELETE FROM sessions WHERE token_hash = ${q(hashToken(token))};`);
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && path === '/api/me') {
    const user = requireUser(req);
    return send(res, 200, { user: publicUser(user), profile: getProfile(user.id), settings: getSettings(user.id) });
  }

  if (method === 'PATCH' && path === '/api/me/profile') {
    const user = requireUser(req);
    const body = await readJson(req);
    const current = getProfile(user.id);
    const displayName = body.displayName === undefined ? current.displayName : String(body.displayName).trim();
    const avatarUrl = body.avatarUrl === undefined ? current.avatarUrl : body.avatarUrl;
    const goalText = body.goalText === undefined ? current.goalText : String(body.goalText).trim();
    const goalType = body.goalType === undefined ? current.goalType : String(body.goalType || 'custom');
    const goalJson = body.goalJson === undefined ? current.goalJson : JSON.stringify(body.goalJson || {});
    assertDisplayName(displayName);
    assertAvatarUrl(avatarUrl);
    assertGoal(goalText);
    exec(`UPDATE profiles SET display_name = ${q(displayName)}, avatar_url = ${q(avatarUrl)}, goal_text = ${q(goalText)},
                            goal_type = ${q(goalType)}, goal_json = ${q(goalJson)}, updated_at = ${q(now())}
          WHERE user_id = ${q(user.id)};`);
    return send(res, 200, { profile: getProfile(user.id) });
  }

  if (method === 'PATCH' && path === '/api/settings') {
    const user = requireUser(req);
    const body = await readJson(req);
    const current = getSettings(user.id);
    const next = {
      autoShowDetails: body.autoShowDetails ?? current.autoShowDetails,
      autoShowChoiceAnswers: body.autoShowChoiceAnswers ?? current.autoShowChoiceAnswers,
      reviewNotifications: body.reviewNotifications ?? current.reviewNotifications,
      streakNotifications: body.streakNotifications ?? current.streakNotifications,
    };
    exec(`UPDATE user_settings SET
            auto_show_details = ${next.autoShowDetails ? 1 : 0},
            auto_show_choice_answers = ${next.autoShowChoiceAnswers ? 1 : 0},
            review_notifications = ${next.reviewNotifications ? 1 : 0},
            streak_notifications = ${next.streakNotifications ? 1 : 0},
            updated_at = ${q(now())}
          WHERE user_id = ${q(user.id)};`);
    return send(res, 200, { settings: getSettings(user.id) });
  }

  if (method === 'GET' && path === '/api/words') {
    requireUser(req);
    const search = url.searchParams.get('q');
    const filter = search ? `AND word LIKE ${q(`%${search}%`)}` : '';
    return send(res, 200, { words: all(`SELECT id, word, pos, meaning, example, example_zh AS exampleZh, roots FROM words WHERE is_active = 1 ${filter} ORDER BY word LIMIT 500;`) });
  }

  if (path.startsWith('/api/admin/words')) return handleAdminWords(req, res, method, path);
  if (path.startsWith('/api/progress')) return handleProgress(req, res, method, path);

  return send(res, 404, { error: { message: '找不到 API' } });
}

async function handleAdminWords(req, res, method, path) {
  requireAdmin(req);
  const match = path.match(/^\/api\/admin\/words\/([^/]+)$/);

  if (method === 'GET' && path === '/api/admin/words') {
    return send(res, 200, { words: all(`SELECT * FROM words ORDER BY word LIMIT 1000;`) });
  }

  if (method === 'POST' && path === '/api/admin/words') {
    const body = await readJson(req);
    validateWord(body);
    const wordId = id('word');
    exec(`INSERT INTO words (id, word, pos, meaning, example, example_zh, roots, created_at, updated_at)
          VALUES (${q(wordId)}, ${q(body.word.trim())}, ${q(body.pos || '')}, ${q(body.meaning.trim())}, ${q(body.example || '')}, ${q(body.exampleZh || '')}, ${q(body.roots || '')}, ${q(now())}, ${q(now())});`);
    return send(res, 201, { word: one(`SELECT * FROM words WHERE id = ${q(wordId)};`) });
  }

  if (match && method === 'PATCH') {
    const body = await readJson(req);
    const current = one(`SELECT * FROM words WHERE id = ${q(match[1])};`);
    if (!current) return send(res, 404, { error: { message: '找不到單字' } });
    const next = {
      word: body.word ?? current.word,
      pos: body.pos ?? current.pos,
      meaning: body.meaning ?? current.meaning,
      example: body.example ?? current.example,
      exampleZh: body.exampleZh ?? current.example_zh,
      roots: body.roots ?? current.roots,
      isActive: body.isActive ?? Boolean(current.is_active),
    };
    validateWord(next);
    exec(`UPDATE words SET word = ${q(next.word.trim())}, pos = ${q(next.pos || '')}, meaning = ${q(next.meaning.trim())},
                          example = ${q(next.example || '')}, example_zh = ${q(next.exampleZh || '')}, roots = ${q(next.roots || '')},
                          is_active = ${next.isActive ? 1 : 0}, updated_at = ${q(now())}
          WHERE id = ${q(match[1])};`);
    return send(res, 200, { word: one(`SELECT * FROM words WHERE id = ${q(match[1])};`) });
  }

  if (match && method === 'DELETE') {
    exec(`UPDATE words SET is_active = 0, deleted_at = ${q(now())}, updated_at = ${q(now())} WHERE id = ${q(match[1])};`);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: { message: '找不到單字管理 API' } });
}

async function handleProgress(req, res, method, path) {
  const user = requireUser(req);
  const match = path.match(/^\/api\/progress\/([^/]+)$/);

  if (method === 'GET' && path === '/api/progress') {
    return send(res, 200, { progress: all(`SELECT * FROM user_word_progress WHERE user_id = ${q(user.id)};`) });
  }

  if (match && method === 'PUT') {
    const body = await readJson(req);
    const box = Number(body.box);
    if (!Number.isInteger(box) || box < 1 || box > 5) throw bad('盒子必須是 1 到 5');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.nextReviewDate || ''))) throw bad('nextReviewDate 必須是 YYYY-MM-DD');
    const ts = now();
    exec(`INSERT INTO user_word_progress (user_id, word_id, box, next_review_date, wrong_count, correct_count, is_wrong, excluded_at, created_at, updated_at)
          VALUES (${q(user.id)}, ${q(match[1])}, ${box}, ${q(body.nextReviewDate)}, ${Number(body.wrongCount || 0)}, ${Number(body.correctCount || 0)}, ${body.isWrong ? 1 : 0}, ${q(body.excludedAt || null)}, ${q(ts)}, ${q(ts)})
          ON CONFLICT(user_id, word_id) DO UPDATE SET
            box = excluded.box,
            next_review_date = excluded.next_review_date,
            wrong_count = excluded.wrong_count,
            correct_count = excluded.correct_count,
            is_wrong = excluded.is_wrong,
            excluded_at = excluded.excluded_at,
            updated_at = excluded.updated_at;`);
    return send(res, 200, { ok: true });
  }

  if (match && method === 'DELETE') {
    exec(`DELETE FROM user_word_progress WHERE user_id = ${q(user.id)} AND word_id = ${q(match[1])};`);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: { message: '找不到進度 API' } });
}

function validateWord(body) {
  if (!String(body.word || '').trim()) throw bad('word 不可為空');
  if (!String(body.meaning || '').trim()) throw bad('meaning 不可為空');
}

function adminHtml() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GRE單字後台</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f3faf9; color: #14213d; }
    main { max-width: 1040px; margin: 0 auto; padding: 28px 18px 60px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 28px; }
    section { background: white; border: 1px solid #d9ebe8; border-radius: 22px; padding: 18px; margin-top: 14px; }
    input, textarea { width: 100%; border: 1px solid #d9ebe8; border-radius: 14px; padding: 12px; font: inherit; background: #f8fcfb; }
    textarea { min-height: 74px; resize: vertical; }
    button { border: 0; border-radius: 14px; padding: 11px 14px; font-weight: 800; cursor: pointer; background: #2f80ed; color: white; }
    button.secondary { background: #e9f4f2; color: #4f6f6a; }
    button.danger { background: #ffe8e8; color: #c0392b; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .wide { grid-column: 1 / -1; }
    .bar { display: flex; gap: 10px; align-items: center; }
    .bar input { max-width: 320px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border-bottom: 1px solid #edf4f3; padding: 10px 8px; text-align: left; vertical-align: top; }
    th { color: #68827f; font-size: 13px; }
    td.actions { width: 160px; white-space: nowrap; }
    .muted { color: #68827f; font-size: 13px; }
    .hidden { display: none; }
    .msg { margin-top: 10px; font-weight: 800; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } header, .bar { align-items: stretch; flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>GRE單字後台</h1>
        <div class="muted">最小管理頁：登入後可新增、編輯、停用單字。</div>
      </div>
      <button class="secondary hidden" id="logout">登出</button>
    </header>

    <section id="login">
      <div class="grid">
        <input id="email" placeholder="管理員 Email" autocomplete="username" />
        <input id="password" placeholder="密碼" type="password" autocomplete="current-password" />
      </div>
      <p><button id="loginBtn">登入</button></p>
    </section>

    <section id="app" class="hidden">
      <div class="bar">
        <input id="q" placeholder="搜尋單字" />
        <button class="secondary" id="reload">重新載入</button>
      </div>
      <form id="wordForm">
        <input type="hidden" id="wordId" />
        <div class="grid" style="margin-top:14px">
          <input id="word" placeholder="word" required />
          <input id="pos" placeholder="詞性" />
          <textarea id="meaning" class="wide" placeholder="中文意思" required></textarea>
          <textarea id="example" class="wide" placeholder="英文例句"></textarea>
          <textarea id="exampleZh" class="wide" placeholder="例句中文翻譯"></textarea>
          <textarea id="roots" class="wide" placeholder="字根/補充"></textarea>
        </div>
        <p class="bar">
          <button id="saveWord">儲存單字</button>
          <button type="button" class="secondary" id="clearForm">清空</button>
        </p>
      </form>
      <table>
        <thead><tr><th>單字</th><th>意思</th><th>狀態</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </section>
    <div class="msg" id="msg"></div>
  </main>
  <script>
    let token = localStorage.getItem('adminToken') || '';
    let words = [];
    const $ = (id) => document.getElementById(id);
    const msg = (text, bad = false) => { $('msg').textContent = text; $('msg').style.color = bad ? '#c0392b' : '#17805f'; };
    const authHeaders = () => ({ 'content-type': 'application/json', authorization: 'Bearer ' + token });
    function showApp() {
      $('login').classList.toggle('hidden', !!token);
      $('app').classList.toggle('hidden', !token);
      $('logout').classList.toggle('hidden', !token);
      if (token) loadWords();
    }
    async function api(path, options = {}) {
      const res = await fetch(path, options);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || '操作失敗');
      return body;
    }
    async function loadWords() {
      const body = await api('/api/admin/words', { headers: authHeaders() });
      const query = $('q').value.trim().toLowerCase();
      words = body.words.filter((w) => !query || w.word.toLowerCase().includes(query));
      $('rows').innerHTML = words.map((w) => '<tr><td><b>' + escapeHtml(w.word) + '</b><div class="muted">' + escapeHtml(w.pos || '') + '</div></td><td>' + escapeHtml(w.meaning) + '</td><td>' + (w.is_active ? '啟用' : '停用') + '</td><td class="actions"><button class="secondary" onclick="editWord(\\'' + w.id + '\\')">編輯</button> <button class="danger" onclick="deleteWord(\\'' + w.id + '\\')">停用</button></td></tr>').join('');
      msg('已載入 ' + words.length + ' 筆單字');
    }
    function escapeHtml(text) {
      return String(text || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    window.editWord = (id) => {
      const w = words.find((item) => item.id === id);
      if (!w) return;
      $('wordId').value = w.id;
      $('word').value = w.word || '';
      $('pos').value = w.pos || '';
      $('meaning').value = w.meaning || '';
      $('example').value = w.example || '';
      $('exampleZh').value = w.example_zh || '';
      $('roots').value = w.roots || '';
      scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.deleteWord = async (id) => {
      if (!confirm('確定停用這個單字？')) return;
      await api('/api/admin/words/' + id, { method: 'DELETE', headers: authHeaders() });
      await loadWords();
    };
    $('loginBtn').onclick = async () => {
      try {
        const body = await api('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('email').value, password: $('password').value }) });
        token = body.token;
        localStorage.setItem('adminToken', token);
        showApp();
      } catch (e) { msg(e.message, true); }
    };
    $('logout').onclick = () => { token = ''; localStorage.removeItem('adminToken'); showApp(); };
    $('reload').onclick = loadWords;
    $('q').oninput = loadWords;
    $('clearForm').onclick = () => $('wordForm').reset();
    $('wordForm').onsubmit = async (event) => {
      event.preventDefault();
      const payload = { word: $('word').value, pos: $('pos').value, meaning: $('meaning').value, example: $('example').value, exampleZh: $('exampleZh').value, roots: $('roots').value };
      const id = $('wordId').value;
      await api(id ? '/api/admin/words/' + id : '/api/admin/words', { method: id ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      $('wordForm').reset();
      await loadWords();
    };
    showApp();
  </script>
</body>
</html>`;
}

function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      const status = error.status || 500;
      send(res, status, { error: { message: status === 500 ? '伺服器錯誤' : error.message } });
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  createServer().listen(port, () => console.log(`backend listening on http://localhost:${port}`));
}

module.exports = { createServer };
