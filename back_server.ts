// back_server.ts

import { Application, Router, Context, send } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// —————————— Mock DB
const passwordHash = await bcrypt.hash("password");
const data = { users: [{ username: "user1", passwordHash }] };

// —————————— App & router
const app = new Application();
const router = new Router();

// —————————— Middleware CORS pré-vol (OPTIONS)
app.use(async (ctx, next) => {
  if (ctx.request.method === "OPTIONS") {
    const origin = ctx.request.headers.get("Origin") ?? "";
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    ctx.response.status = 204;
    return;
  }
  await next();
});

// —————————— Clé pour JWT
const secret = "votre_clé_secrète";
const cryptoKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

// —————————— Middleware d’authentification
async function auth(ctx: Context, next: () => Promise<unknown>) {
  const token = await ctx.cookies.get("jwt");
  if (!token) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Non autorisé" };
    return;
  }
  try {
    await verify(token, cryptoKey);
    await next();
  } catch {
    ctx.response.status = 401;
    ctx.response.body = { message: "Token invalide" };
  }
}

// —————————— Route POST /login
router.post("/login", async (ctx) => {
  const { username, password } = await ctx.request.body({ type: "json" }).value;
  const user = data.users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    ctx.response.status = 401;
    ctx.response.body = { message: "Bad credentials" };
    return;
  }

  // ajoute CORS pour login
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");

  // création du JWT
  const payload = { iss: username, exp: getNumericDate(60 * 60) };
  const jwt = await create({ alg: "HS256", typ: "JWT" }, payload, cryptoKey);

  ctx.cookies.set("jwt", jwt, { httpOnly: true, maxAge: 60 * 60, path: "/" });
  ctx.response.body = { message: "Login successful" };
});

// —————————— Route protégée GET /quiz
router.get("/quiz", auth, async (ctx) => {
  // CORS également sur la route quiz si front en cross-origin
  const origin = ctx.request.headers.get("Origin") ?? "";
  ctx.response.headers.set("Access-Control-Allow-Origin", origin);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");

  // sert le fichier quiz.html depuis le dossier front_end
  await send(ctx, "quizz.html", {
    root: `${Deno.cwd()}/front_end`,
    index: "quizz.html",
  });
});

// —————————— Routes & écoute
app.use(router.routes());
app.use(router.allowedMethods());

console.log("🚀 Back-end sur le port 3000");
await app.listen({ port: 3000 });
