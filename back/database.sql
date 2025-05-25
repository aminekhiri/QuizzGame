-- base de données pour le quiz avec postgreSQL

CREATE TABLE IF NOT EXISTS users (
  username      TEXT PRIMARY KEY,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS difficulties (
  difficulty_id SERIAL PRIMARY KEY,
  level         TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  question_id    SERIAL PRIMARY KEY,
  external_id    TEXT UNIQUE,
  category_id    INTEGER NOT NULL REFERENCES categories(category_id),
  difficulty_id  INTEGER NOT NULL REFERENCES difficulties(difficulty_id),
  question_text  TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong_answers  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  session_id       SERIAL PRIMARY KEY,
  username         TEXT    NOT NULL REFERENCES users(username),
  category_code    TEXT    NOT NULL,     -- on stocke directement le code
  difficulty_level TEXT    NOT NULL,     -- idem pour le niveau
  question_count   INTEGER NOT NULL,
  total_score      INTEGER NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS best_scores (
  username         TEXT    NOT NULL REFERENCES users(username),
  category_code    TEXT    NOT NULL,
  difficulty_level TEXT    NOT NULL,
  question_count   INTEGER NOT NULL,
  best_score       INTEGER NOT NULL,
  PRIMARY KEY(username, category_code, difficulty_level, question_count)
);


INSERT INTO users (
  username,
  first_name,
  last_name,
  password_hash,
  is_admin
) VALUES (
  'admin',
  'Super',
  'Admin',
  '$2a$10$dw4wHMJdDEbfoLjTZc5rGeNnWhTNMp/5NH1uJOUUUe9Pe0s.f33SW', 
  TRUE
)
ON CONFLICT (username)
DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      is_admin      = EXCLUDED.is_admin;


INSERT INTO difficulties(level) VALUES
  ('easy'),
  ('medium'),
  ('hard')
ON CONFLICT (level) DO NOTHING;

