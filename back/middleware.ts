// Authorization and middleware functions

import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { SECRET } from "./utils.ts";
import { withClient } from "./db.ts";

// Middleware for CORS
export async function corsMiddleware(ctx: Context, next: () => Promise<unknown>) {
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
}

// ——— Middleware d'authentification
export async function auth(ctx: Context, next: () => Promise<unknown>) {
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

// Admin-only middleware
export async function adminOnly(ctx: Context, next: () => Promise<unknown>) {
  // on récupère is_admin depuis Postgres
  const result = await withClient(client =>
    client.queryObject({
      text: `SELECT is_admin
             FROM users
             WHERE username = $1`,
      args: [ctx.state.username],
    })
  );

  const isAdmin = (result as { rows: { is_admin: boolean }[] }).rows[0]?.is_admin;
  if (!isAdmin) {
    ctx.response.status = 403;
    ctx.response.body   = { message: "Accès admin uniquement" };
    return;
  }

  await next();
}
