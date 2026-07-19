import { TRPCError } from '@trpc/server';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * In-memory fixed-window rate limiter, keyed by caller-provided id (e.g. IP + route).
 * Single-process only — swap for a shared store (Redis, etc.) before scaling past one instance.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Please try again later.' });
  }

  bucket.count += 1;
}
