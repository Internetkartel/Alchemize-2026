import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { initSurrealDB } from "./lib/surrealdb";

const app = new Hono();

// Native app requests (iOS/Android) don't send an Origin header, so CORS only
// matters for the web build. Restrict to the production web domain (app.json's
// router.origin) and localhost for local dev.
const ALLOWED_ORIGINS = ["https://alchemize.app"];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
      return null;
    },
  }),
);

let surrealReady = false;
let surrealInitError: string | null = null;

export const surrealInitialization = initSurrealDB()
  .then(() => {
    surrealReady = true;
  })
  .catch((error) => {
    surrealInitError = error instanceof Error ? error.message : "Unknown SurrealDB init error";
    console.error("[Hono] Failed to initialize SurrealDB:", error);
    throw error;
  });

// Fail closed for API traffic until the database is ready. This middleware
// must be registered before the tRPC handler so requests cannot bypass it.
app.use("/api/trpc/*", async (c, next) => {
  if (!surrealReady) {
    return c.json(
      { status: "error", message: "Service temporarily unavailable" },
      503,
    );
  }
  await next();
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  if (!surrealReady) {
    return c.json(
      { status: "error", message: "SurrealDB not initialized", error: surrealInitError },
      503,
    );
  }
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
