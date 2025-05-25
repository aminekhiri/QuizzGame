// filepath: /home/ubuntu/QuizzGame/back/server.ts
// Main server file that combines all components

// Charger les variables d'environnement depuis .env
import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
try {
  await load({ export: true, path: "./.env" });
  console.log("✅ Variables d'environnement chargées avec succès");
} catch (e) {
  console.error("❌ Erreur lors du chargement des variables d'environnement:", e);
  try {
    // Essayer avec le chemin absolu vers le fichier .env du répertoire parent
    await load({ export: true, path: "../.env" });
    console.log("✅ Variables d'environnement chargées depuis le répertoire parent");
  } catch (e) {
    console.error("❌ Impossible de charger le fichier .env. Certaines fonctionnalités peuvent ne pas fonctionner correctement:", e);
  }
}

// Imports principaux
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

// Import des modules locaux
import { corsMiddleware } from "./middleware.ts";
import { setupAuthRoutes } from "./routes/auth.ts";
import { setupUserRoutes } from "./routes/user.ts";
import { setupAdminRoutes } from "./routes/admin.ts";
import { setupQuizRoutes } from "./routes/quiz.ts";
import { setupMultiplayerRoutes } from "./ws.ts";



// Initialiser l'application Oak
const app = new Application();

// Appliquer le middleware CORS
app.use(oakCors({
  origin: Deno.env.get("CORS_ORIGIN") || "https://localhost:8080",
  credentials: true,
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type","Authorization"]
}));

// Appliquer le middleware pré-vol OPTIONS et CORS
app.use(corsMiddleware);

// Créer un router et monter toutes les routes
const router = new Router();

// Ajouter un endpoint ping pour la vérification de l'état
router.get("/ping", (ctx) => {
  ctx.response.body = "pong";
});

// Configurer tous les groupes de routes
setupAuthRoutes(router);
setupUserRoutes(router);
setupAdminRoutes(router);
setupQuizRoutes(router);
setupMultiplayerRoutes(router);

// Monter le router sur l'application
app.use(router.routes());
app.use(router.allowedMethods());

// Démarrer le serveur
const PORT = Number(Deno.env.get("PORT") ?? 3000);
const HOST = Deno.env.get("HOST") ?? "localhost";

// Chargement des certificats SSL
console.log(`Démarrage du serveur sur ${HOST}:${PORT}...`);


const options = {
    hostname: HOST,
    port: PORT,
    secure: true,
    cert: await Deno.readTextFile("../certificate/cert.pem"),
    key: await Deno.readTextFile("../certificate/key.pem"),
};

console.log("🚀 Serveur HTTPS sur https://" + HOST + ":" + PORT);
await app.listen(options);

