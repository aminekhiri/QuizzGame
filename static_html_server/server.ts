// server.ts

import { Application, send } from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
const USE_HTTPS = Deno.args.includes("--https");
const ROOT = `${Deno.cwd()}/front_end`;

// Middleware principal : envoie le fichier demandé ou index.html
app.use(async (ctx) => {
  try {
    // send utilise ctx.request.url.pathname pour déterminer quel fichier renvoyer
    await send(ctx, ctx.request.url.pathname, {
      root: ROOT,
      index: "login.html",   // ← ici on ne met que "index.html", pas "front_end/index.html"
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body = "404 File not found";
  }
});

const port = Deno.args[0] ? Number(Deno.args[0]) : 8080;

const options = {
  cert : await Deno.readTextFile("../cert.pem"),
  key : await Deno.readTextFile("../key.pem"),
  
}
console.log(`🔒 SSL enabled (HTTPS)`);
// console.log(`📂 Static server running on port ${port}, serving ${ROOT}`);

await app.listen({
  port:   port,
  secure: true,
  cert:   options.cert,
  key:    options.key,
});

// await app.listen({ port: port });
