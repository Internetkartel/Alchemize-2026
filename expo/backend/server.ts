import { serve } from '@hono/node-server';
import app, { surrealInitialization } from './hono';

const port = Number(process.env.PORT || 8787);

async function start() {
  try {
    await surrealInitialization;

    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`[backend] Listening on http://localhost:${info.port}`);
    });
  } catch (error) {
    console.error('[backend] Startup aborted because SurrealDB failed to initialize:', error);
    process.exit(1);
  }
}

void start();
