function cleanEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Email 格式不正確');
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw bad('密碼至少需要 8 個字');
}

function assertDisplayName(name) {
  if (typeof name !== 'string' || name.trim().length < 2) throw bad('顯示名稱至少需要 2 個字');
  if (name.trim().length > 24) throw bad('顯示名稱最多 24 個字');
}

function assertAvatarUrl(url) {
  if (url === null || url === undefined || url === '') return;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw bad('頭像必須是 http 或 https 圖片 URL');
  }
}

function assertGoal(goal) {
  if (typeof goal !== 'string' || goal.trim().length === 0) throw bad('請輸入個人目標');
  if (goal.trim().length > 200) throw bad('個人目標最多 200 個字');
}

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

module.exports = { cleanEmail, assertEmail, assertPassword, assertDisplayName, assertAvatarUrl, assertGoal, bad };
