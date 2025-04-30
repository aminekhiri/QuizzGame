// back_server.ts

// ❶ Charger les variables d’environnement depuis .env
import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
await load({ export: true });

// ❷ Imports Oak, CORS, JWT, bcrypt, SQLite
import { Application, Router, Context, send } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors }                       from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { hash, compare }                 from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify, getNumericDate }from "https://deno.land/x/djwt@v2.8/mod.ts";
import { DB }                            from "https://deno.land/x/sqlite@v3.9.1/mod.ts";


// ——— Paramètres
const RAW_SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET")!);
const DB_FILE    = Deno.env.get("SQLITE_FILE") || "quiz.db";

// ——— Construire un CryptoKey pour djwt
const SECRET = await crypto.subtle.importKey(
  "raw",
  RAW_SECRET,
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);

// ——— Initialisation de la base SQLite
const db = new DB(DB_FILE);

// Création des tables
db.query(`
CREATE TABLE IF NOT EXISTS users (
  username      TEXT    PRIMARY KEY,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    DATETIME DEFAULT (datetime('now')),
  last_login    DATETIME
);
`);
db.query(`
CREATE TABLE IF NOT EXISTS categories (
  category_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    UNIQUE NOT NULL,
  name          TEXT    NOT NULL
);
`);
db.query(`
CREATE TABLE IF NOT EXISTS difficulties (
  difficulty_id INTEGER PRIMARY KEY AUTOINCREMENT,
  level         TEXT    UNIQUE NOT NULL
);
`);
db.query(`
CREATE TABLE IF NOT EXISTS questions (
  question_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id    TEXT    UNIQUE,
  category_id    INTEGER NOT NULL,
  difficulty_id  INTEGER NOT NULL,
  question_text  TEXT    NOT NULL,
  correct_answer TEXT    NOT NULL,
  wrong_answers  TEXT    NOT NULL,
  FOREIGN KEY(category_id)   REFERENCES categories(category_id),
  FOREIGN KEY(difficulty_id) REFERENCES difficulties(difficulty_id)
);
`);
db.query(`
CREATE TABLE IF NOT EXISTS quiz_sessions (
  session_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL,
  category_id    INTEGER,
  difficulty_id  INTEGER,
  started_at     DATETIME DEFAULT (datetime('now')),
  ended_at       DATETIME,
  total_score    INTEGER DEFAULT 0,
  FOREIGN KEY(username)      REFERENCES users(username),
  FOREIGN KEY(category_id)   REFERENCES categories(category_id),
  FOREIGN KEY(difficulty_id) REFERENCES difficulties(difficulty_id)
);
`);
db.query(`
CREATE TABLE IF NOT EXISTS session_answers (
  answer_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL,
  question_id    INTEGER NOT NULL,
  given_answer   TEXT    NOT NULL,
  is_correct     INTEGER NOT NULL,
  answered_at    DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY(session_id)  REFERENCES quiz_sessions(session_id),
  FOREIGN KEY(question_id) REFERENCES questions(question_id)
);
`);

// ——— Application Oak
const app = new Application();

// ——— CORS global
app.use(oakCors({
  origin:      Deno.env.get("CORS_ORIGIN")  || "http://localhost:8080",
  credentials: true
}));

// ——— Pré-vol OPTIONS
app.use(async (ctx, next) => {
  if (ctx.request.method === "OPTIONS") {
    const origin = ctx.request.headers.get("Origin") ?? "";
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    ctx.response.status = 204;
  } else {
    await next();
  }
});

// ——— Middleware d’authentification
async function auth(ctx: Context, next: () => Promise<unknown>) {
  const token = await ctx.cookies.get("jwt");
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body   = { message: "Non autorisé" };
    return;
  }
  try {
    const payload = await verify(token, SECRET);
    ctx.state.username = payload.iss;
    await next();
  } catch {
    ctx.response.status = 401;
    ctx.response.body   = { message: "Token invalide" };
  }
}

// ——— Router
const router = new Router();

/**
 * POST /signup
 * Body: { first_name, last_name, username, password }
 */
router.post("/signup", async (ctx) => {
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");

  const { first_name, last_name, username, password } = await ctx.request
    .body({ type: "json" }).value;
  const password_hash = await hash(password);

  try {
    db.query(
      `INSERT INTO users(username, first_name, last_name, password_hash)
       VALUES (?,?,?,?)`,
      [username, first_name, last_name, password_hash]
    );
    ctx.response.status = 201;
    ctx.response.body   = { message: "Utilisateur créé" };
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed: users.username")) {
      ctx.response.status = 409;
      ctx.response.body   = { message: "Nom d'utilisateur déjà utilisé" };
    } else {
      console.error(err);
      ctx.response.status = 500;
      ctx.response.body   = { message: "Erreur interne" };
    }
  }
});

/**
 * POST /login
 * Body: { username, password }
 */
router.post("/login", async (ctx) => {
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");

  try {
    const { username, password } = await ctx.request.body({ type: "json" }).value;
    const rows = [...db.query(
      `SELECT password_hash FROM users WHERE username = ?`,
      [username]
    )];
    if (!rows.length || !(await compare(password, rows[0][0] as string))) {
      ctx.response.status = 401;
      ctx.response.body   = { message: "Bad credentials" };
      return;
    }

    const payload = { iss: username, exp: getNumericDate(60 * 60) };
    const jwt = await create({ alg: "HS256", typ: "JWT" }, payload, SECRET);

    ctx.cookies.set("jwt", jwt, {
      httpOnly: true,
      maxAge:   60 * 60,
      path:     "/"
    });

    ctx.response.body = { message: "Login successful" };
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body   = { message: "Invalid request", error: err.message };
  }
});

/**
 * GET /api/me
 */
router.get("/api/me", auth, (ctx) => {
  const username = ctx.state.username as string;
  const rows = [...db.query(
    `SELECT first_name, last_name FROM users WHERE username = ?`,
    [username]
  )];
  if (rows.length) {
    const [first_name, last_name] = rows[0] as [string, string];
    ctx.response.body = { username, first_name, last_name };
  } else {
    ctx.response.status = 404;
    ctx.response.body   = { message: "Utilisateur non trouvé" };
  }
});

/**
 * GET /quiz
 */
router.get("/quiz", auth, async (ctx) => {
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  await send(ctx, "quizz.html", {
    root:  `${Deno.cwd()}/front_end`,
    index: "quizz.html",
  });
});

// ——— Monter le router et démarrer
app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Back-end sur le port 3000");
await app.listen({ port: 3000 });
