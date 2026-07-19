import { serve } from '@hono/node-server';
import app from './hono';

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[backend] Listening on http://localhost:${info.port}`);
});
