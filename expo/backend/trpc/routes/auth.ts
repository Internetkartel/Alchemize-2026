import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../create-context';
import { createUser, loginUser } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rate-limit';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

function clientKey(req: Request, route: string, email: string): string {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  return `${route}:${ip}:${email.toLowerCase()}`;
}

export const authRouter = createTRPCRouter({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      checkRateLimit(clientKey(ctx.req, 'signup', input.email), RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
      try {
        const result = await createUser(input.email, input.password, input.name);
        return { success: true, user: result };
      } catch (error: any) {
        throw new Error(error.message || 'Signup failed');
      }
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      checkRateLimit(clientKey(ctx.req, 'login', input.email), RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
      try {
        const result = await loginUser(input.email, input.password);
        return { success: true, user: result };
      } catch (error: any) {
        throw new Error(error.message || 'Login failed');
      }
    }),
});
