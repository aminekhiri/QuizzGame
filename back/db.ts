// Database connection and utilities


// helper pour obtenir/restituer un client
import type { PoolClient, QueryObjectResult } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
await load({ export: true });      // ← Charger .env AVANT d'utiliser Deno.env.get

// Configuration de la base de données avec valeurs par défaut
// ——— Initialisation du pool PostgreSQL
const pool = new Pool({
  user:     Deno.env.get("PG_USER")!,
  password: Deno.env.get("PG_PASSWORD")!,
  database: Deno.env.get("PG_DATABASE")!,
  hostname: Deno.env.get("PG_HOST")!,
  port:     Number(Deno.env.get("PG_PORT") ?? 5432),

}, 3); // taille du pool


async function withClient<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

;(async () => {
  const data = await Deno.readTextFile("./database.sql");   // fichier SQL pour la base de données
  await withClient(client =>
    client.queryArray(data)                         // exécute tous les statements
  );
  console.log("✅ Schéma PostgreSQL initialisé");
})();

// ❺ Importation automatique des données Trivia
;(async () => {
  const BASE = "https://the-trivia-api.com";

  // — 1) Catégories
  const catRes = await fetch(`${BASE}/api/categories`);
  const cats   = await catRes.json() as Record<string, string[]>;
  for (const [name, codes] of Object.entries(cats)) {
    const code = codes[0] || name.toLowerCase().replace(/\s+/g, "_");
    await withClient(c =>
      c.queryObject({
        text: `
          INSERT INTO categories (code, name)
          VALUES ($1, $2)
          ON CONFLICT(code) DO UPDATE SET name = EXCLUDED.name
        `,
        args: [code, name],
      })
    );
  }

  // — 2) Difficultés (fixes)
  for (const level of ["easy", "medium", "hard"]) {
    await withClient(c =>
      c.queryObject({
        text: `
          INSERT INTO difficulties (level)
          VALUES ($1)
          ON CONFLICT(level) DO NOTHING
        `,
        args: [level],
      })
    );
  }

  // — 3) Questions
  //    Tu peux ajuster limit pour en charger plus ou moins
  const qRes = await fetch(`${BASE}/api/questions?limit=100&type=multipleChoice`);
  const questions = await qRes.json() as any[];
  for (const q of questions) {
    // Récupérer les IDs de category & difficulty
    const code = q.category ?? q.category?.code ?? "general_knowledge"; // une catégorie par défaut
    const diff = q.difficulty ?? q.difficulty?.level;

    // Récupérer l'ID de catégorie
    const categoryResult: QueryObjectResult<{ category_id: number }> = await withClient(c =>
      c.queryObject<{ category_id: number }>({
        text: `SELECT category_id FROM categories WHERE code = $1`,
        args: [code],
      })
    );
    
    // Si la catégorie n'est pas trouvée, utiliser une catégorie par défaut (ID 1)
    let category_id = 1;
    if (categoryResult.rows && categoryResult.rows.length > 0) {
      category_id = categoryResult.rows[0].category_id;
    } else {
    }
    
    // Récupère l'ID de difficulty avec typage explicite
    const result: QueryObjectResult<{ difficulty_id: number }> = await withClient(c =>
      c.queryObject<{ difficulty_id: number }>({
        text: `SELECT difficulty_id FROM difficulties WHERE level = $1`,
        args: [diff],
      })
    );
    
    // Vérifier si des résultats ont été trouvés pour la difficulté
    if (!result.rows || result.rows.length === 0) {
      continue; // Passer à la question suivante
    }
    
    const { difficulty_id } = result.rows[0];

    await withClient(c =>
      c.queryObject({
        text: `
          INSERT INTO questions
            (external_id, category_id, difficulty_id, question_text, correct_answer, wrong_answers)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT(external_id) DO NOTHING
        `,
        args: [
          q.id,
          category_id,
          difficulty_id,
          typeof q.question === "object" ? q.question.text : q.question,
          q.correctAnswer,
          JSON.stringify(q.incorrectAnswers)
        ],
      })
    );
  }

  console.log("✅ Import Trivia API terminé");
})();

export { Pool, withClient };

