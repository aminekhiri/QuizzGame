// server.ts

import { Application, send } from "https://deno.land/x/oak@v12.6.1/mod.ts";

const app = new Application();
const ROOT = `${Deno.cwd()}/front_end/`;

// Middleware principal : envoie le fichier demandé ou index.html
app.use(async (ctx) => {
  let path = ctx.request.url.pathname;

  // 1) Si c'est la racine, on pointe vers /login/login.html
  if (path === "/" ) {
    path = "/login/login.html";
  } else {
    const parts = path.split("/").filter(Boolean);
    // 2) Si l'URL est /foo (un seul segment) et que ça ne contient pas d'extension,
    //    on le transforme en /foo/foo.html
    if (parts.length === 1 && !parts[0].includes(".")) {
      path = `/${parts[0]}/${parts[0]}.html`;
    }
    // 3) Sinon on laisse tomber tel quel (/login/script.js, /media/brain.png, etc.)
  }

  try {
    await send(ctx, path, {
      root: ROOT,
    });
  } catch {
    ctx.response.status = 404;
    ctx.response.body   = "404 File not found";
  }
});

const port = Deno.args[0] ? Number(Deno.args[0]) : 8080;

const options = {
  cert : await Deno.readTextFile("../certificate/cert.pem"),
  key : await Deno.readTextFile("../certificate/key.pem"),
  
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
