// Utility functions

import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
// charge .env et expose Deno.env.get()
await load({ export: true });


// ——— Paramètres
const RAW_SECRET = new TextEncoder().encode(Deno.env.get("JWT_SECRET")!);

// ——— Construire un CryptoKey pour djwt
export const SECRET = await crypto.subtle.importKey(
  "raw",
  RAW_SECRET,
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"]
);
// Fonction pour générer un token JWT
export async function generateJWT(username: string, expirationInSeconds: number = 7 * 24 * 60 * 60): Promise<string> {
  return await create(
    { alg: "HS256", typ: "JWT" },
    { iss: username, exp: getNumericDate(expirationInSeconds) },
    SECRET
  );
}

// WebSocket helper
export function safeSend(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/** Mélange un tableau en place (Fisher–Yates) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Récupère 10 questions multiple choice depuis The Trivia API,
 * les mélange et retourne un tableau d'objets { text, choices, correct }.
 */
export async function pick10Questions() {
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
