// WebSocket handling for multiplayer functionality

import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { safeSend, pick10Questions } from "./utils.ts";

// file d'attente globale
const waiting: { ws: WebSocket; username: string }[] = [];

export async function startMatch(
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

// Configure WebSocket routes
export function setupMultiplayerRoutes(router: Router) {
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
          // pas de partenaire dispo, on s'ajoute à la file
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
}
