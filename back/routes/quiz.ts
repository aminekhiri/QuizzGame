// Quiz-related routes

import { Router, Context, send } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { auth } from "../middleware.ts";
import { withClient } from "../db.ts";

export function setupQuizRoutes(router: Router) {
  /**
   * GET /quiz
   */
  router.get("/quiz", auth, async (ctx) => {
    const origin = ctx.request.headers.get("Origin") ?? "";
    ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
    await send(ctx, "quizz.html", {
      root:  `${Deno.cwd()}/../static_html_server/front_end/quizz`,
      index: "quizz.html",
    });
  });

  // Route pour finir un quiz et sauvegarder session + best_scores
  router.post("/api/quiz/complete", auth, async (ctx) => {
    const username = ctx.state.username as string;
    const {
      category_code,
      difficulty_level,
      total_score,
      question_count
    } = await ctx.request.body({ type: "json" }).value as {
      category_code: string;
      difficulty_level: string;
      total_score: number;
      question_count: number;
    };

    if (!category_code || !difficulty_level) {
      return ctx.throw(400, "Category code et difficulty level requis");
    }

    // 1) Insérer la session
    const session = await withClient(c =>
      c.queryObject({
        text: `
          INSERT INTO quiz_sessions
            (username, category_code, difficulty_level, question_count, total_score)
          VALUES ($1,$2,$3,$4,$5)
          RETURNING session_id
        `,
        args: [username, category_code, difficulty_level, question_count, total_score],
      })
    ) as { rows: { session_id: number } };
    const session_id = session.rows[0].session_id;

    // 3) Upsert best_scores
    await withClient(c =>
      c.queryObject({
        text: `
          INSERT INTO best_scores
            (username, category_code, difficulty_level, question_count, best_score)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (username, category_code, difficulty_level, question_count)
          DO UPDATE SET best_score = EXCLUDED.best_score
            WHERE EXCLUDED.best_score > best_scores.best_score
        `,
        args: [username, category_code, difficulty_level, question_count, total_score],
      })
    );

    ctx.response.status = 200;
    ctx.response.body   = { message: "Session et best score enregistrés" };
  });
}
