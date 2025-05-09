// back_server.ts

// ❶ Charger les variables d’environnement depuis .env
import { load} from "https://deno.land/std@0.203.0/dotenv/mod.ts";
await load({ export: true });

// ❷ Imports Oak, CORS, JWT, bcrypt, SQLite
import { Application, Router, Context, send} from "https://deno.land/x/oak@v12.6.1/mod.ts";
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
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
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

db.query(`
  CREATE TABLE IF NOT EXISTS best_scores (
    username        TEXT    NOT NULL REFERENCES users(username),
    category_id     INTEGER NOT NULL REFERENCES categories(category_id),
    difficulty_id   INTEGER NOT NULL REFERENCES difficulties(difficulty_id),
    question_count  INTEGER NOT NULL DEFAULT 10,
    best_score      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (username, category_id, difficulty_id, question_count)
  );
`);


// compte administrateur
db.query(`
  INSERT OR IGNORE INTO users(
    username,
    first_name,
    last_name,
    password_hash,
    is_admin
  ) VALUES (?, ?, ?, ?, ?)
`, [
  'admin',
  'Super',
  'Admin',
  await hash("admin"),
  1              // 1 pour true
]);

  


// ——— Application Oak
const app = new Application();

// ——— CORS global
app.use(oakCors({
  origin: (requestOrigin) => {
    // autorise http://localhost:8080 ET https://localhost:8080
    if (
      requestOrigin === "http://localhost:8080" ||
      requestOrigin === "https://localhost:8080"
    ) {
      return requestOrigin;
    }
    return ""; // sinon origin refusée
  },
  credentials: true,
}));


// ——— Pré-vol OPTIONS
app.use(async (ctx, next) => {
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");

  if (ctx.request.method === "OPTIONS") {
    // on répond directement, sans next()
    ctx.response.status = 204;
    return;
  }
  // pour POST/GET/etc. on passe au middleware suivant une seule fois
  await next();
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


async function adminOnly(ctx: Context, next: () => Promise<unknown>) {
  const rows = [...db.query(
    `SELECT is_admin FROM users WHERE username = ?`,
    [ctx.state.username]
  )];
  if (!rows.length || rows[0][0] !== 1) {
    ctx.response.status = 403;
    ctx.response.body   = { message: "Accès admin uniquement" };
    return;
  }
  await next();
}


// ——— Router
const router = new Router();

//route pour récupérer les utilisateurs pour le compte admin
router.get(
  "/api/admin/users",
   auth,
   adminOnly,
  (ctx) => {
    const rows = [...db.query(`
      SELECT
        username,
        first_name,
        last_name,
        is_admin,
        created_at,
        last_login
      FROM users
    `)];
    // Transformer les tuples en objets
    const users = rows.map(([username, first_name, last_name, is_admin, created_at, last_login]) => ({
      username,
      first_name,
      last_name,
      is_admin: is_admin === true,
      created_at,
      last_login
    }));
    ctx.response.body = { users };
  }
);



// Route pour finir un quiz et sauvegarder session + best_scores
router.post("/api/quiz/complete", auth, async (ctx) => {
  const username = ctx.state.username as string;
  const {
    category_id,
    difficulty_id,
    total_score,
    question_count   // ← récupéré depuis le front
  } = await ctx.request.body({ type: "json" }).value;

  // 1) Enregistrement de la session
  db.query(`
    INSERT INTO quiz_sessions
      (username, category_id, difficulty_id, total_score)
    VALUES (?,?,?,?)
  `, [username, category_id, difficulty_id, total_score]);

  // 2) Upsert best_scores en incluant question_count
  db.query(`
    INSERT INTO best_scores
      (username, category_id, difficulty_id, question_count, best_score)
    VALUES (?,?,?,?,?)
    ON CONFLICT(username, category_id, difficulty_id, question_count)
    DO UPDATE SET best_score = excluded.best_score
      WHERE excluded.best_score > best_scores.best_score
  `, [username, category_id, difficulty_id, question_count, total_score]);

  ctx.response.status = 200;
  ctx.response.body   = { message: "Session enregistrée" };
});


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
 * GET /logout
*/
router.get("/logout", (ctx) => {
  ctx.cookies.delete("jwt", { path: "/" });   // supprime le cookie
  ctx.response.status = 204;                  // No Content
});


/**
 * GET /api/me
 */
router.get("/api/me", auth, (ctx) => {
  const username = ctx.state.username as string;
  // On récupère first_name, last_name ET is_admin en une seule requête
  const rows = [...db.query(
    `SELECT first_name, last_name, is_admin FROM users WHERE username = ?`,
    [username]
  )];

  if (rows.length) {
    const [first_name, last_name, is_admin] = rows[0] as [string, string, number];
    ctx.response.body = {
      username,
      first_name,
      last_name,
      // transforme 0|1 en false|true
      is_admin: is_admin === 1
    };
  } else {
    ctx.response.status = 404;
    ctx.response.body   = { message: "Utilisateur non trouvé" };
  }
});


/**
 * GET /api/best-scores
 * Renvoie tous les meilleurs scores de l'utilisateur connecté
 */
router.get("/api/best-scores", auth, (ctx) => {
  const username = ctx.state.username as string;
  // On joint best_scores → categories → difficulties pour remonter labels
  const rows = [...db.query(`
    SELECT c.name, d.level, b.best_score
    FROM best_scores b
    JOIN categories c   ON b.category_id   = c.category_id
    JOIN difficulties d ON b.difficulty_id = d.difficulty_id
    WHERE b.username = ?
  `, [username])];

  // Transforme en JSON
  const result = rows.map(([category, difficulty, best_score]) => ({
    category,
    difficulty,
    score: best_score
  }));

  ctx.response.body = result;
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

/** Mélange un tableau en place (Fisher–Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


/**
 * Récupère 10 questions multiple choice depuis The Trivia API,
 * les mélange et retourne un tableau d’objets { text, choices, correct }.
 */
async function pick10Questions() {
  // 1) Récupérer 10 questions
  const res = await fetch("https://the-trivia-api.com/api/questions?limit=10&type=multipleChoice");
  if (!res.ok) throw new Error(`Trivia API status ${res.status}`);
  const data = await res.json(); //récupère les données

  // 2) Formater chaque question
  return data.map((q: any) => {
    // texte brut (string ou { text })
    const text = typeof q.question === 'object' ? q.question.text : q.question;

    const correct = q.correctAnswer;
    const wrongs  = q.incorrectAnswers;
    const choices = shuffle([correct, ...wrongs]);

    return { text, choices, correct };
  });
}

async function startMatch(
  p1: { ws: WebSocket; username: string },
  p2: { ws: WebSocket; username: string },
) {
  const questions = await pick10Questions();
  let idx = 0;

  const scores: Record<string, number> = {
    [p1.username]: 0,
    [p2.username]: 0,
  };

  // Indique si chaque joueur a déjà répondu à la question en cours
  let responded: Record<string, boolean> = {
    [p1.username]: false,
    [p2.username]: false,
  };

  // 1) Envoi du match found
  p1.ws.send(JSON.stringify({ type: "matched", opponent: p2.username }));
  p2.ws.send(JSON.stringify({ type: "matched", opponent: p1.username }));

  // 2) Gestion des messages (réponses) pour chaque joueur
  const handleAnswer = (player: { ws: WebSocket; username: string }) => {
    player.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type !== "answer" || responded[player.username]) return;
      // On ne compte qu’une seule réponse par question
      responded[player.username] = true;
      // Si la réponse est correcte, on incrémente le score de CE joueur
      if (msg.answer === questions[idx].correct) {
        scores[player.username]++;
      }
    };
  };

  handleAnswer(p1);
  handleAnswer(p2);

  function resetResponded() {
    responded[p1.username] = false;
    responded[p2.username] = false;
  }
  

  // 3) Fonction récursive qui pose la question n°idx
  const poseQuestion = () => {
    if (idx >= questions.length) {
      // 4) Fin du match : on calcule l’issue pour chacun
      const s1 = scores[p1.username], s2 = scores[p2.username];
      const out1 = s1 > s2 ? "win" : s1 < s2 ? "lose" : "draw";
      const out2 = s2 > s1 ? "win" : s2 < s1 ? "lose" : "draw";

      p1.ws.send(JSON.stringify({ type: "end", outcome: out1 }));
      p2.ws.send(JSON.stringify({ type: "end", outcome: out2 }));
      return;
    }

    // Réinitialise la traçabilité des réponses
    responded[p1.username] = false;
    responded[p2.username] = false;

    // 5) Envoi de la question synchronisée
    const q = questions[idx];
    [p1.ws, p2.ws].forEach(ws =>
      ws.send(JSON.stringify({
        type:     "question",
        question: q.text,
        choices:  q.choices,
        time:     q.time ?? 15
      }))
    );

    // 6) Après la durée du timer, on diffuse les scores individuellement
    setTimeout(() => {
      [p1, p2].forEach(player => {
        const other = player === p1 ? p2 : p1;     // ← récupère l’adversaire
        player.ws.send(JSON.stringify({
          type:    "scores",
          you:     scores[player.username],
          them:    scores[other.username],
          correct: questions[idx].correct
        }));
      });
      

      // 7) On attend encore 5 s pour que le client affiche vert/rouge
      setTimeout(() => {
        idx++;
        poseQuestion();
      }, 5000);

    }, (q.time ?? 15) * 1000);
  };

  resetResponded(); 

  // 8) Lancement de la première question
  poseQuestion();
}


// file d’attente globale
const waiting: { ws: WebSocket; username: string }[] = [];

router.get("/multiplayer", async (ctx) => {
  if (!ctx.isUpgradable) return ctx.throw(400);
  const ws = await ctx.upgrade();

  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "join") {
      const username = msg.username as string;

      // 1) Si ce socket est déjà en attente, on ignore
      if (waiting.some(p => p.ws === ws)) return;

      // 2) Cherche un partenaire différent
      const partnerIndex = waiting.findIndex(p => p.ws !== ws);
      if (partnerIndex !== -1) {
        // on a trouvé un autre joueur en attente
        const partner = waiting.splice(partnerIndex, 1)[0];
        // pas besoin de garder le joueur courant en file
        await startMatch({ ws, username }, partner);
      } else {
        // pas de partenaire dispo, on s’ajoute à la file
        waiting.push({ ws, username });
      }
    }
  };

  ws.onclose = () => {
    // si on se déconnecte sans matcher, on retire de la file
    const idx = waiting.findIndex(p => p.ws === ws);
    if (idx !== -1) waiting.splice(idx, 1);
  };
});


// ——— Monter le router et démarrer
app.use(router.routes());
app.use(router.allowedMethods());



const options = {
  port: 3000,
  cert: await Deno.readTextFile("./cert.pem"),
  key: await Deno.readTextFile("./key.pem"),
};

// Démarrage avec le listener personnalisé
console.log(`🚀 Serveur HTTPS sur https://localhost:${options.port}`);

await app.listen({
  port:   options.port,
  secure: true,
  cert:   options.cert,
  key:    options.key,
});

// console.log("🚀 Back-end HTTP sur http://localhost:3000");
// await app.listen({ port: 3000 });