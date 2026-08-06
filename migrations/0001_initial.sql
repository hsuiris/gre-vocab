CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 24),
  avatar_url TEXT,
  goal_text TEXT NOT NULL DEFAULT '每天複習 20 個單字',
  goal_type TEXT NOT NULL DEFAULT 'custom',
  goal_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auto_show_details INTEGER NOT NULL DEFAULT 0 CHECK (auto_show_details IN (0, 1)),
  auto_show_choice_answers INTEGER NOT NULL DEFAULT 1 CHECK (auto_show_choice_answers IN (0, 1)),
  review_notifications INTEGER NOT NULL DEFAULT 0 CHECK (review_notifications IN (0, 1)),
  streak_notifications INTEGER NOT NULL DEFAULT 0 CHECK (streak_notifications IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  pos TEXT NOT NULL DEFAULT '',
  meaning TEXT NOT NULL,
  example TEXT NOT NULL DEFAULT '',
  example_zh TEXT NOT NULL DEFAULT '',
  roots TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_word_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id TEXT NOT NULL REFERENCES words(id),
  box INTEGER NOT NULL CHECK (box BETWEEN 1 AND 5),
  next_review_date TEXT NOT NULL,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  is_wrong INTEGER NOT NULL DEFAULT 0 CHECK (is_wrong IN (0, 1)),
  excluded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_words_active_word ON words(is_active, word);
CREATE INDEX IF NOT EXISTS idx_progress_due ON user_word_progress(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_progress_wrong ON user_word_progress(user_id, is_wrong);
