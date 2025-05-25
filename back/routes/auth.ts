// Authentication routes (login, signup, logout, token refresh)

import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { auth } from "../middleware.ts";
import { withClient } from "../db.ts";
import { SECRET, generateJWT } from "../utils.ts";

export function setupAuthRoutes(router: Router) {
  /**
   * POST /signup
   * Body: { first_name, last_name, username, password }
   */
  router.post("/signup", async (ctx) => {
    // CORS
    const origin = ctx.request.headers.get("Origin") ?? "";
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");

    // Récupérer les données
    const { first_name, last_name, username, password } = await ctx.request
      .body({ type: "json" }).value;
    const password_hash = await hash(password);

    try {
      // Insérer dans Postgres
      await withClient(client =>
        client.queryObject({
          text: `
            INSERT INTO users (username, first_name, last_name, password_hash)
            VALUES ($1, $2, $3, $4)
          `,
          args: [username, first_name, last_name, password_hash],
        })
      );

      ctx.response.status = 201;
      ctx.response.body   = { message: "Utilisateur créé" };
    } catch (err) {
      // Code 23505 = violation de contrainte UNIQUE
      if ((err as { code?: string }).code === "23505") {
        ctx.response.status = 409;
        ctx.response.body   = { message: "Nom d'utilisateur déjà utilisé" };
      } else {
        console.error("Erreur interne signup :", err);
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
    // CORS
    const origin = ctx.request.headers.get("Origin") ?? "";
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");

    try {
      // 1) Récupérer les identifiants
      const { username, password } = await ctx.request.body({ type: "json" }).value;

      // 2) Charger le hash depuis Postgres
      const result = await withClient(client =>
        client.queryObject({
          text: `
            SELECT password_hash
              FROM users
             WHERE username = $1
          `,
          args: [username],
        })
      );

      const rows = (result as { rows: { password_hash: string }[] }).rows;
      const passwordHash = rows[0]?.password_hash;
      if (!passwordHash || !(await compare(password, passwordHash))) {
        ctx.response.status = 401;
        ctx.response.body   = { message: "Bad credentials" };
        return;
      }

      // 3) Générer le JWT
      // Define token lifetime (7 days)
      const TOKEN_LIFETIME = 7 * 24 * 60 * 60; // seconds
      const jwt = await generateJWT(username, TOKEN_LIFETIME);
      
      // 4) Stocker en cookie
      ctx.cookies.set("jwt", jwt, {
        httpOnly: true,
        secure:   true,
        sameSite: "none",
        maxAge:   TOKEN_LIFETIME,
        path:     "/",
      });

      ctx.response.body = { message: "Login successful", token: jwt };
    } catch (err) {
      ctx.response.status = 400;
      ctx.response.body   = { message: "Invalid request", error: (err as Error).message };
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
   * GET /api/refresh-token
   * Permet de rafraîchir le token JWT si l'utilisateur a déjà un cookie valide
   */
  router.get("/api/refresh-token", async (ctx) => {
    try {
      // Vérifier si un cookie existe
      const tokenFromCookie = await ctx.cookies.get("jwt");
      
      if (!tokenFromCookie) {
        ctx.response.status = 401;
        ctx.response.body = { message: "No token to refresh" };
        return;
      }
      
      // Vérifier si le token est valide
      try {
        const payload = await verify(tokenFromCookie, SECRET, "HS256");
        const username = payload.iss;
        
        // Générer un nouveau token
        const TOKEN_LIFETIME = 7 * 24 * 60 * 60; // 7 jours en secondes
        const newToken = await generateJWT(username, TOKEN_LIFETIME);
        
        // Mettre à jour le cookie
        ctx.cookies.set("jwt", newToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: TOKEN_LIFETIME,
          path: "/",
        });
        
        // Envoyer également le token dans la réponse pour mise à jour du sessionStorage
        ctx.response.body = { message: "Token refreshed", token: newToken };
        
      } catch (err) {
        console.error("Token refresh failed:", err);
        ctx.response.status = 401;
        ctx.response.body = { message: "Invalid token" };
      }
      
    } catch (err) {
      ctx.response.status = 500;
      ctx.response.body = { message: "Internal server error" };
    }
  });
}
