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
  origin: "https://localhost:8080",
  credentials: true,
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type"]
}));


// ——— Pré-vol OPTIONS
app.use(async (ctx, next) => {
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");

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
  // 1) Rechercher Bearer token dans Authorization
  const authHeader = ctx.request.headers.get("Authorization");
  let token: string | null = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  // 2) Sinon, fallback sur cookie
  if (!token) {
    token = await ctx.cookies.get("jwt") || null;
  }
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Missing token" };
    return;
  }
  try {
    const payload = await verify(token, SECRET, "HS256");
    ctx.state.username = payload.iss;
    await next();
  } catch {
    ctx.response.status = 401;
    ctx.response.body = { message: "Invalid or expired token" };
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


//route pour supprimer un compte utilisateur
/**
 * DELETE /api/me
 * Supprime l’utilisateur connecté et toutes ses données associées
 */
router.delete("/api/me", auth, async (ctx: Context) => {
  const username = ctx.state.username as string;

  try {
    // 1) Supprimer les réponses de sessions de quiz
    db.query(
      `DELETE FROM session_answers
         WHERE session_id IN (
           SELECT session_id FROM quiz_sessions WHERE username = ?
         );`,
      [username],
    );

    // 2) Supprimer les sessions de quiz
    db.query(
      `DELETE FROM quiz_sessions WHERE username = ?;`,
      [username],
    );

    // 3) Supprimer les meilleurs scores
    db.query(
      `DELETE FROM best_scores WHERE username = ?;`,
      [username],
    );

    // 4) Supprimer l’utilisateur
    db.query(
      `DELETE FROM users WHERE username = ?;`,
      [username],
    );

    // 5) Invalider le cookie JWT côté client
    ctx.cookies.delete("jwt", { path: "/" });

    // 6) Répondre 204 No Content
    ctx.response.status = 204;
  } catch (err) {
    console.error("Erreur suppression compte et données associées :", err);
    ctx.response.status = 500;
    ctx.response.body = { message: "Erreur interne lors de la suppression du compte" };
  }
});




// Route pour finir un quiz et sauvegarder session + best_scores
router.post("/api/quiz/complete", auth, async (ctx: Context) => {
  const username = ctx.state.username as string;
  const {
    category_code,
    difficulty_level,
    total_score,
    question_count
  } = await ctx.request.body({ type: "json" }).value;

  // 0) Valider les entrées
  // Si vous autorisez "all", gérez-le ici (e.g. en SKIPPANT l'upsert dans best_scores)
  if (!category_code || !difficulty_level) {
    ctx.response.status = 400;
    ctx.response.body   = { message: "Category code et difficulty level requis" };
    return;
  }

  // 1) Récupérer category_id
  const catRows = [...db.query(
    `SELECT category_id
       FROM categories
      WHERE code = ?`,
    [category_code],
  )];
  if (!catRows.length) {
    ctx.response.status = 400;
    ctx.response.body   = { message: "Code de catégorie invalide" };
    return;
  }
  const category_id = catRows[0][0] as number;

  // 2) Récupérer difficulty_id
  const diffRows = [...db.query(
    `SELECT difficulty_id
       FROM difficulties
      WHERE level = ?`,
    [difficulty_level],
  )];
  if (!diffRows.length) {
    ctx.response.status = 400;
    ctx.response.body   = { message: "Niveau de difficulté invalide" };
    return;
  }
  const difficulty_id = diffRows[0][0] as number;

  // 3) Enregistrement de la session
  db.query(`
    INSERT INTO quiz_sessions
      (username, category_id, difficulty_id, total_score)
    VALUES (?,?,?,?)
  `, [username, category_id, difficulty_id, total_score]);

  // 4) Upsert best_scores
  db.query(`
    INSERT INTO best_scores
      (username, category_id, difficulty_id, question_count, total_score)
    VALUES (?,?,?,?,?)
    ON CONFLICT(username, category_id, difficulty_id, question_count)
    DO UPDATE SET best_score = excluded.best_score
      WHERE excluded.best_score > best_scores.best_score;
  `, [username, category_id, difficulty_id, question_count, total_score]);

    // DEBUG — confirmer ce qui a été écrit
  console.log("▶ best_scores for", username, [...db.query(
    `SELECT category_id, difficulty_id, question_count, best_score
       FROM best_scores
      WHERE username = ?`,
    [username]
  )]);


  ctx.response.status = 200;
  ctx.response.body   = { message: "Session et best score enregistrés" };
});


/**
 * DELETE /api/admin/users/:username
 * Permet à un admin de supprimer un utilisateur et toutes ses données
 */
router.delete(
  "/api/admin/users/:username",
  auth,
  adminOnly,
  async (ctx: Context) => {
    const targetUser = ctx.params.username!;
    try {
      // 1) Supprimer les réponses de sessions
      db.query(
        `DELETE FROM session_answers
           WHERE session_id IN (
             SELECT session_id FROM quiz_sessions WHERE username = ?
           );`,
        [targetUser],
      );
      // 2) Supprimer les sessions de quiz
      db.query(
        `DELETE FROM quiz_sessions WHERE username = ?;`,
        [targetUser],
      );
      // 3) Supprimer les best_scores
      db.query(
        `DELETE FROM best_scores WHERE username = ?;`,
        [targetUser],
      );
      // 4) Supprimer l’utilisateur
      db.query(
        `DELETE FROM users WHERE username = ?;`,
        [targetUser],
      );

      ctx.response.status = 204; // No Content
    } catch (err) {
      console.error("Erreur suppression utilisateur admin:", err);
      ctx.response.status = 500;
      ctx.response.body = { message: "Erreur interne lors de la suppression" };
    }
  }
);


/**
 * POST /admin/users/:username
 */
router.post("/admmin/users/:username",
  auth,
  adminOnly,
  
)

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
      secure:   true,
      sameSite: "none",
      maxAge:   3600,
      path:     "/"
    });

    ctx.response.body = { message: "Login successful", token: jwt };
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
router.get("/api/best-scores", auth, (ctx: Context) => {
  const username = ctx.state.username as string;

  // On joint categories & difficulties pour récupérer leur libellé
  const rows = [...db.query(`
    SELECT
      c.name        AS category,
      d.level       AS difficulty,
      bs.question_count,
      bs.best_score
    FROM best_scores bs
    JOIN categories c  ON bs.category_id   = c.category_id
    JOIN difficulties d ON bs.difficulty_id = d.difficulty_id
    WHERE bs.username = ?;
  `, [username])];

  const bestScores = rows.map((
    [category, difficulty, question_count, best_score]
  ) => ({
    category:        category as string,
    difficulty:      difficulty as string,
    question_count:  question_count as number,
    best_score:      best_score as number,
  }));

  ctx.response.body = bestScores;
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



//Pour le multijoueur on va utiliser un WebSocket

// en haut de back_server.ts
function safeSend(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}


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
  return data.map((q : any) => {
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

  const responded: Record<string, boolean> = {
    [p1.username]: false,
    [p2.username]: false,
  };

  
  safeSend(p1.ws, { type: 'matched', opponent: p2.username });
  safeSend(p2.ws, { type: 'matched', opponent: p1.username });



  function poseQuestion() {
    if (idx >= questions.length) {
      const s1 = scores[p1.username], s2 = scores[p2.username];
      safeSend(p1.ws, { type: "end", outcome: s1 > s2 ? "win" : s1 < s2 ? "lose" : "draw" });
      safeSend(p2.ws, { type: "end", outcome: s2 > s1 ? "win" : s2 < s1 ? "lose" : "draw" });
      return;
    }

    // reset responses
    responded[p1.username] = false;
    responded[p2.username] = false;

    const q = questions[idx];
    const currentIdx = idx;
    [p1.ws, p2.ws].forEach(ws =>
      safeSend(ws, {
        type:     "question",
        question: q.text,
        choices:  q.choices,
        time:     q.time ?? 15
      })
    );

  // À la fin du chrono de cette question, on envoie les scores
  setTimeout(() => {
    [p1, p2].forEach(player => {
      const other = player === p1 ? p2 : p1;
      safeSend(player.ws, {
        type:    "scores",
        you:     scores[player.username],
        them:    scores[other.username],
        correct: questions[currentIdx].correct
      });
    });


      //On attend 5 secondes après le reveal de la réponse pour passer à la question suivante
      setTimeout(() => {
        idx++;
        poseQuestion();
      }, 5000);
    }, (q.time ?? 15) * 1000);
  }

  function handleAnswer(player: { ws: WebSocket; username: string }) {
    player.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type !== "answer" || responded[player.username]) return;
      responded[player.username] = true;
      if (msg.answer === questions[idx].correct) {
        scores[player.username]++;
      }
    };
  }

  handleAnswer(p1);
  handleAnswer(p2);

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
  cert: await Deno.readTextFile("./certificate/cert.pem"),
  key: await Deno.readTextFile("./certificate/key.pem"),
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

