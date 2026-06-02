import { redis } from "./redis.server";

/**
 * Fixed-window rate limit using Upstash INCR + EXPIRE.
 * Returns { allowed, remaining, resetSec }.
 */
export async function checkRate(
  userId: string,
  action: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; resetSec: number }> {
  const key = `rate:${userId}:${action}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  const ttl = await redis.ttl(key);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetSec: ttl > 0 ? ttl : windowSec,
  };
}

export async function assertRate(
  userId: string,
  action: string,
  limit: number,
  windowSec: number,
): Promise<void> {
  const { allowed, resetSec } = await checkRate(userId, action, limit, windowSec);
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Try again in ${resetSec}s.`);
  }
}
