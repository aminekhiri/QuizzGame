-- 1) UTILISATEURS
CREATE TABLE users (
  username      VARCHAR(50) PRIMARY KEY,  -- on utilise le pseudo comme PK
  first_name    VARCHAR(50) NOT NULL,
  last_name     VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMP
);

-- 2) CATÉGORIES DE QUIZ
CREATE TABLE categories (
  category_id  SERIAL PRIMARY KEY,
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL
);

-- 3) DIFFICULTÉS
CREATE TABLE difficulties (
  difficulty_id SERIAL PRIMARY KEY,
  level         VARCHAR(10) UNIQUE NOT NULL  -- 'easy', 'medium', 'hard'
);

-- 4) QUESTIONS
CREATE TABLE questions (
  question_id    SERIAL PRIMARY KEY,
  external_id    VARCHAR(50) UNIQUE,                -- ID externe (API)
  category_id    INT NOT NULL REFERENCES categories(category_id),
  difficulty_id  INT NOT NULL REFERENCES difficulties(difficulty_id),
  question_text  TEXT    NOT NULL,
  correct_answer TEXT    NOT NULL,
  wrong_answers  TEXT[]                               -- Tableau des réponses incorrectes
);

-- 5) SESSIONS DE QUIZ
CREATE TABLE quiz_sessions (
  session_id     SERIAL PRIMARY KEY,
  username       VARCHAR(50) NOT NULL 
                   REFERENCES users(username),      -- FK vers users.username
  category_id    INT REFERENCES categories(category_id),
  difficulty_id  INT REFERENCES difficulties(difficulty_id),
  started_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at       TIMESTAMP,
  total_score    INT DEFAULT 0
);

-- 6) RÉPONSES DES UTILISATEURS
CREATE TABLE session_answers (
  answer_id      SERIAL PRIMARY KEY,
  session_id     INT NOT NULL 
                   REFERENCES quiz_sessions(session_id),
  question_id    INT NOT NULL 
                   REFERENCES questions(question_id),
  given_answer   TEXT NOT NULL,
  is_correct     BOOLEAN NOT NULL,
  answered_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
