import { Queue, QueueEvents } from 'bullmq';
import { redis } from '../lib/redis';

/**
 * BullMQ Queue definition
 *
 * Uses Redis-backed delayed jobs (queue.add(name, data, { delay })) — NOT cron jobs.
 * Each email is added as a delayed job that fires at its scheduled time.
 */

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobData {
  jobId: string;
  userId: string;
  senderConfigId: string;
  senderEmail: string;
  senderName: string;
  recipient: string;
  recipientName?: string | null;
  subject: string;
  body: string;
  hourlyLimit: number;
  delaySeconds: number;
  leadCount: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redis,
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[Queue] Job ${jobId} failed: ${failedReason}`);
});

emailQueueEvents.on('completed', ({ jobId }) => {
  console.log(`[Queue] Job ${jobId} completed`);
});

/**
 * Add a single email job to the queue with a delay.
 * The delay is calculated as the difference between the scheduled time and now.
 * Uses BullMQ's native delayed jobs — queue.add(name, data, { delay }).
 */
export async function scheduleEmailJob(
  data: EmailJobData,
  scheduledFor: Date
): Promise<void> {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());

  await emailQueue.add('send-email', data, {
    delay,
    jobId: data.jobId,
  });

  console.log(
    `[Queue] Scheduled job ${data.jobId} for ${scheduledFor.toISOString()} (delay: ${delay}ms) — recipient: ${data.recipient}`
  );
}

/**
 * Reschedule a job to a new time (used when rate limit is exceeded).
 * Removes the old job and adds a new one with the updated delay.
 */
export async function rescheduleEmailJob(
  data: EmailJobData,
  newScheduledFor: Date
): Promise<void> {
  const delay = Math.max(0, newScheduledFor.getTime() - Date.now());

  await emailQueue.add('send-email', data, {
    delay,
    jobId: `${data.jobId}-retry-${Date.now()}`,
  });

  console.log(
    `[Queue] Rescheduled job ${data.jobId} to ${newScheduledFor.toISOString()} (delay: ${delay}ms)`
  );
}
