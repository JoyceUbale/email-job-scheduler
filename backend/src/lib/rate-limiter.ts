import { redis } from './redis';

/**
 * Rate Limiting Engine — Redis sliding counters
 *
 * Uses a key pattern `hour_window:sender_id:<hourTimestamp>` to track how many
 * emails a sender has sent in the current hour window. The counter is atomic
 * (INCR) so it is safe across multiple worker instances.
 *
 * If the hourly limit is exceeded, the job is rescheduled to the start of the
 * next hour window instead of being dropped.
 */

const HOUR_WINDOW_PREFIX = 'hour_window';
const HOUR_SECONDS = 3600;

function getHourKey(senderId: string, date: Date = new Date()): string {
  const hourTimestamp = Math.floor(date.getTime() / (HOUR_SECONDS * 1000)) * (HOUR_SECONDS * 1000);
  return `${HOUR_WINDOW_PREFIX}:${senderId}:${hourTimestamp}`;
}

function getNextHourStart(date: Date = new Date()): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfter?: Date;
}

/**
 * Atomically increments the sender's hourly counter and checks against the limit.
 * If the limit is exceeded, the counter is decremented back (the job is not consuming
 * a slot) and the caller should reschedule.
 */
export async function checkAndIncrementRateLimit(
  senderId: string,
  hourlyLimit: number
): Promise<RateLimitResult> {
  const key = getHourKey(senderId);
  const count = await redis.incr(key);

  // Set TTL on first increment so the key expires after the hour window
  if (count === 1) {
    await redis.expire(key, HOUR_SECONDS + 60);
  }

  if (count > hourlyLimit) {
    // Exceeded — decrement back so we don't consume a slot
    await redis.decr(key);
    const retryAfter = getNextHourStart();
    return {
      allowed: false,
      currentCount: count - 1,
      limit: hourlyLimit,
      retryAfter,
    };
  }

  return {
    allowed: true,
    currentCount: count,
    limit: hourlyLimit,
  };
}

/**
 * Get the current count for a sender in the active hour window without incrementing.
 */
export async function getSenderHourlyCount(senderId: string): Promise<number> {
  const key = getHourKey(senderId);
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Calculate the delay (in ms) until the next hour window starts.
 */
export function getDelayUntilNextHour(from: Date = new Date()): number {
  const nextHour = getNextHourStart(from);
  return nextHour.getTime() - from.getTime();
}
