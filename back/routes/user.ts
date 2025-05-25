// User profile and data routes

import { Router, Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { auth } from "../middleware.ts";
import { withClient } from "../db.ts";

export function setupUserRoutes(router: Router) {
  /**
   * GET /api/me
   */
  router.get("/api/me", auth, async (ctx) => {
    const username = ctx.state.username as string;

    // récupérer first_name, last_name et is_admin depuis Postgres
    const result = await withClient(client =>
      client.queryObject({
        text: `
          SELECT first_name, last_name, is_admin
            FROM users
           WHERE username = $1
        `,
        args: [username],
      })
    );

    const rows = (result as { rows: any[] }).rows;
    if (rows.length) {
      const { first_name, last_name, is_admin } = rows[0] as {
        first_name: string;
        last_name: string;
        is_admin: boolean;
      };

      ctx.response.body = {
        username,
        first_name,
        last_name,
        is_admin
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body   = { message: "Utilisateur non trouvé" };
    }
  });

  /**
   * DELETE /api/me
   * Supprime l'utilisateur connecté et toutes ses données associées
   */
  router.delete("/api/me", auth, async (ctx) => {
    const username = ctx.state.username as string;

    try {
      // 1) Supprimer les réponses de sessions de quiz
      await withClient(client =>
        client.queryObject({
          text: `
            DELETE FROM session_answers
             WHERE session_id IN (
               SELECT session_id FROM quiz_sessions WHERE username = $1
             )
          `,
          args: [username],
        })
      );

      // 2) Supprimer les sessions de quiz
      await withClient(client =>
        client.queryObject({
          text: `DELETE FROM quiz_sessions WHERE username = $1`,
          args: [username],
        })
      );

      // 3) Supprimer les meilleurs scores
      await withClient(client =>
        client.queryObject({
          text: `DELETE FROM best_scores WHERE username = $1`,
          args: [username],
        })
      );

      // 4) Supprimer l'utilisateur
      await withClient(client =>
        client.queryObject({
          text: `DELETE FROM users WHERE username = $1`,
          args: [username],
        })
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

  /**
   * GET /api/best-scores
   * Renvoie tous les meilleurs scores de l'utilisateur connecté
   */
  router.get("/api/best-scores", auth, async (ctx: Context) => {
    const username = ctx.state.username as string;

    // Récupérer les meilleurs scores depuis Postgres
    const result = await withClient(client =>
      client.queryObject({
        text: `
          SELECT
            bs.category_code    AS category,
            bs.difficulty_level AS difficulty,
            bs.question_count,
            bs.best_score
          FROM best_scores bs
          WHERE bs.username = $1;
        `,
        args: [username],
      })
    ) as { rows: any[] };

    // Transformer les lignes en objets
    const bestScores = result.rows.map(({
      category,
      difficulty,
      question_count,
      best_score
    }) => ({
      category,
      difficulty,
      question_count,
      best_score
    }));

    ctx.response.body = bestScores;
  });
}
