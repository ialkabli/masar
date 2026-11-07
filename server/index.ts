import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import serveStatic from "@fastify/static";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ZodError, z } from "zod";
import { database } from "./db.js";
import { accounts, identify, signIn, hash, fail } from "./auth.js";
import { domain } from "./domain.js";
declare module "fastify" {
  interface FastifyRequest {
    user: any;
  }
}
export async function createApp(
  location = process.env.DATABASE_URL || "./data/database",
) {
  const db = await database(location);
  await accounts(db);
  const app = Fastify({
    logger: process.env.LOG_REQUESTS === "true",
    bodyLimit: 1_048_576,
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    );
    if (req.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
      const origin = req.headers.origin;
      if (
        origin &&
        origin !== `http://${req.headers.host}` &&
        origin !== `https://${req.headers.host}`
      )
        fail("مصدر الطلب غير مسموح", 403);
      if (!["/api/login", "/api/health"].includes(req.url.split("?")[0]))
        req.user = await identify(db, req.headers.authorization);
    }
  });
  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof ZodError)
      return reply.code(400).send({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("، "),
      });
    if (["23505", "23503", "23514", "23P01"].includes(err.code))
      return reply
        .code(409)
        .send({ error: "تعارض في البيانات؛ حدّث الصفحة وحاول مجددًا" });
    const status =
      err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) req.log.error(err);
    reply.code(status).send({
      error: status === 500 ? "حدث خطأ داخلي؛ حاول مجددًا" : err.message,
    });
  });
  app.get("/api/health", async () => ({ ok: true }));
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => {
      const body = z
        .object({
          email: z.string().email().max(150),
          password: z.string().min(1).max(128),
        })
        .parse(req.body);
      return signIn(db, body.email, body.password);
    },
  );
  app.get("/api/me", async (req) => ({ user: req.user }));
  app.post("/api/logout", async (req) => {
    await db.tx((q) =>
      q("DELETE FROM sessions WHERE token_hash=$1", [
        hash(req.headers.authorization!.slice(7)),
      ]),
    );
    return { ok: true };
  });
  await domain(app, db);
  if (existsSync(resolve("dist/client/index.html")))
    await app.register(serveStatic, { root: resolve("dist/client") });
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith("/api/")
      ? reply.code(404).send({ error: "المسار غير موجود" })
      : existsSync(resolve("dist/client/index.html"))
        ? reply.sendFile("index.html")
        : reply
            .code(404)
            .send({ error: "شغّل npm run build أولًا أو افتح خادم Vite" }),
  );
  app.addHook("onClose", async () => db.close());
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const app = await createApp();
  await app.listen({
    host: "127.0.0.1",
    port: Number(process.env.PORT || 8343),
  });
  console.log(
    "Local only: http://127.0.0.1:" + Number(process.env.PORT || 8343),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
