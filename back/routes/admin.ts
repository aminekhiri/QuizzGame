// Admin-specific routes

import { Router, Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { auth, adminOnly } from "../middleware.ts";
import { withClient } from "../db.ts";

export function setupAdminRoutes(router: Router) {
  // Route pour récupérer les utilisateurs pour le compte admin
  router.get(
    "/api/admin/users",
    auth,
    adminOnly,
    async (ctx) => {
      // récupérer tous les utilisateurs depuis Postgres
      const result = await withClient(client =>
        client.queryObject({
          text: `
            SELECT
              username,
              first_name,
              last_name,
              is_admin,
              created_at,
              last_login
            FROM users
          `,
        })
      );

      // transformer en objets au même format
      const users = (result as { rows: any[] }).rows.map(({
        username,
        first_name,
        last_name,
        is_admin,
        created_at,
        last_login
      }) => ({
        username,
        first_name,
        last_name,
        is_admin,      // déjà un booléen en Postgres
        created_at,
        last_login
      }));

      ctx.response.body = { users };
    }
  );

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
        await withClient(client =>
          client.queryObject({
            text: `
              DELETE FROM session_answers
               WHERE session_id IN (
                 SELECT session_id FROM quiz_sessions WHERE username = $1
               )
            `,
            args: [targetUser],
          })
        );

        // 2) Supprimer les sessions de quiz
        await withClient(client =>
          client.queryObject({
            text: `DELETE FROM quiz_sessions WHERE username = $1`,
            args: [targetUser],
          })
        );

        // 3) Supprimer les meilleurs scores
        await withClient(client =>
          client.queryObject({
            text: `DELETE FROM best_scores WHERE username = $1`,
            args: [targetUser],
          })
        );

        // 4) Supprimer l'utilisateur
        await withClient(client =>
          client.queryObject({
            text: `DELETE FROM users WHERE username = $1`,
            args: [targetUser],
          })
        );

        ctx.response.status = 204; // No Content
      } catch (err) {
        console.error("Erreur suppression utilisateur admin:", err);
        ctx.response.status = 500;
        ctx.response.body = { message: "Erreur interne lors de la suppression" };
      }
    }
  );

  // Enregistrer une nouvelle catégorie
  router.post("/api/admin/categories", auth, adminOnly, async (ctx) => {
    const { code, name } = await ctx.request.body({ type: "json" }).value;
    try {
      await withClient(client =>
        client.queryObject({
          text: `
            INSERT INTO categories (code, name)
            VALUES ($1, $2)
          `,
          args: [code, name],
        })
      );
      ctx.response.status = 201;
      ctx.response.body   = { message: "Catégorie créée" };
    } catch (err: any) {
      if (err.code === "23505") {
        ctx.response.status = 409;
        ctx.response.body   = { message: "Code de catégorie déjà existant" };
      } else {
        console.error("Erreur création catégorie :", err);
        ctx.response.status = 500;
        ctx.response.body   = { message: "Erreur interne" };
      }
    }
  });

  // Enregistrer un nouveau niveau de difficulté
  router.post("/api/admin/difficulties", auth, adminOnly, async (ctx) => {
    const { level } = await ctx.request.body({ type: "json" }).value;
    try {
      await withClient(client =>
        client.queryObject({
          text: `
            INSERT INTO difficulties (level)
            VALUES ($1)
          `,
          args: [level],
        })
      );
      ctx.response.status = 201;
      ctx.response.body   = { message: "Difficulté créée" };
    } catch (err: any) {
      if (err.code === "23505") {
        ctx.response.status = 409;
        ctx.response.body   = { message: "Niveau déjà existant" };
      } else {
        console.error("Erreur création difficulté :", err);
        ctx.response.status = 500;
        ctx.response.body   = { message: "Erreur interne" };
      }
    }
  });

  // Enregistrer une nouvelle question
  router.post("/api/admin/questions", auth, adminOnly, async (ctx) => {
    const {
      external_id,
      category_code,
      difficulty_level,
      question_text,
      correct_answer,
      wrong_answers // tableau de strings
    } = await ctx.request.body({ type: "json" }).value;

    try {
      // récupérer category_id
      const cat = await withClient(client =>
        client.queryObject({
          text: `SELECT category_id FROM categories WHERE code = $1`,
          args: [category_code],
        })
      ) as { rows: any[] };
      if (cat.rows.length === 0) {
        ctx.response.status = 400;
        ctx.response.body   = { message: "Code de catégorie invalide" };
        return;
      }
      const category_id = cat.rows[0].category_id;

      // récupérer difficulty_id
      const diff = await withClient(client =>
        client.queryObject({
          text: `SELECT difficulty_id FROM difficulties WHERE level = $1`,
          args: [difficulty_level],
        })
      ) as { rows: any[] };
      if (diff.rows.length === 0) {
        ctx.response.status = 400;
        ctx.response.body   = { message: "Niveau de difficulté invalide" };
        return;
      }
      const difficulty_id = diff.rows[0].difficulty_id;

      // insérer la question
      await withClient(client =>
        client.queryObject({
          text: `
            INSERT INTO questions
              (external_id, category_id, difficulty_id, question_text, correct_answer, wrong_answers)
            VALUES ($1,$2,$3,$4,$5,$6)
          `,
          args: [
            external_id,
            category_id,
            difficulty_id,
            question_text,
            correct_answer,
            JSON.stringify(wrong_answers)
          ],
        })
      );

      ctx.response.status = 201;
      ctx.response.body   = { message: "Question créée" };
    } catch (err: any) {
      if (err.code === "23505") {
        ctx.response.status = 409;
        ctx.response.body   = { message: "Question déjà existante" };
      } else {
        console.error("Erreur création question :", err);
        ctx.response.status = 500;
        ctx.response.body   = { message: "Erreur interne" };
      }
    }
  });

  
}
