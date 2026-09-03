import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { sendSlackRateLimitNotification } from '../lib/slack';
import { updateEmailIndex } from '../lib/elasticsearch';
import { EmailJobData, rescheduleEmailJob } from '../queue/email-queue';

/**
 * Redis sliding-window counter keyed as `hour_window:<sender_id>`.
 *
 * Overflow emails are not dropped: they are delayed to the next hour window
 * via BullMQ, and a Slack webhook is fired when the sender hits the limit.
 */

const HOUR_WINDOW_PREFIX = 'hour_window';
const HOUR_SECONDS = 3600;
const HOUR_MS = HOUR_SECONDS * 1000;

function hourBucketStart(date: Date = new Date()): number {
  return Math.floor(date.getTime() / HOUR_MS) * HOUR_MS;
}

/** Redis key: hour_window:<sender_id>:<hourTimestamp> */
export function getHourWindowKey(senderId: string, date: Date = new Date()): string {
  return `${HOUR_WINDOW_PREFIX}:${senderId}:${hourBucketStart(date)}`;
}

export function getNextHourWindowStart(date: Date = new Date()): Date {
  const next = new Date(hourBucketStart(date) + HOUR_MS);
  return next;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfter?: Date;
}

/**
 * Atomically increment the sender's hourly counter (INCR) and compare to the limit.
 * On overflow, decrement so the job does not consume a slot.
 */
export async function checkAndIncrementRateLimit(
  senderId: string,
  hourlyLimit: number
): Promise<RateLimitResult> {
  const key = getHourWindowKey(senderId);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, HOUR_SECONDS + 60);
  }

  if (count > hourlyLimit) {
    await redis.decr(key);
    return {
      allowed: false,
      currentCount: count - 1,
      limit: hourlyLimit,
      retryAfter: getNextHourWindowStart(),
    };
  }

  return {
    allowed: true,
    currentCount: count,
    limit: hourlyLimit,
  };
}

export async function getSenderHourlyCount(senderId: string): Promise<number> {
  const count = await redis.get(getHourWindowKey(senderId));
  return count ? parseInt(count, 10) : 0;
}

export function getDelayUntilNextHour(from: Date = new Date()): number {
  return getNextHourWindowStart(from).getTime() - from.getTime();
}

/**
 * Enforce the hourly cap for a queued email. When the cap is hit:
 * 1. Reschedule the job to the next hour window
 * 2. Trigger a Slack webhook (no-op if Slack is not connected)
 * 3. Persist the new scheduled time
 */
export async function enforceHourlyRateLimit(job: EmailJobData): Promise<RateLimitResult> {
  const result = await checkAndIncrementRateLimit(job.senderConfigId, job.hourlyLimit);

  if (result.allowed || !result.retryAfter) {
    return result;
  }

  const retryAfter = result.retryAfter;

  console.log(
    `[RateLimiter] hour_window:${job.senderConfigId} exceeded (${result.currentCount}/${result.limit}). Rescheduling ${job.jobId} to ${retryAfter.toISOString()}`
  );

  await sendSlackRateLimitNotification({
    userId: job.userId,
    senderEmail: job.senderEmail,
    message: `Sender *${job.senderEmail}* has reached the hourly limit of ${result.limit} emails. Job for *${job.recipient}* has been rescheduled to ${retryAfter.toISOString()}.`,
  });

  await rescheduleEmailJob(job, retryAfter);

  await prisma.emailJob.update({
    where: { id: job.jobId },
    data: {
      scheduledFor: retryAfter,
      slackNotified: true,
    },
  });

  await updateEmailIndex(job.jobId, {
    status: 'pending',
    scheduledFor: retryAfter.toISOString(),
  });

  return result;
}
