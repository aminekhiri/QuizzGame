// server.ts

import { Application, send } from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
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

// Lecture du port (et, optionnellement, du certificat et de la clé pour HTTPS)
if (Deno.args.length < 1) {
  console.log(
    `Usage: deno run --allow-net --allow-read=./ server.ts PORT [CERT_PATH KEY_PATH]`,
  );
  Deno.exit();
}

const port = Number(Deno.args[0]);
const options: any = { port };

if (Deno.args.length >= 3) {
  options.secure = true;
  options.cert = await Deno.readTextFile(Deno.args[1]);
  options.key = await Deno.readTextFile(Deno.args[2]);
  console.log(`🔒 SSL enabled (HTTPS)`);
}

console.log(`📂 Static server running on port ${port}, serving ${ROOT}`);
await app.listen(options);
