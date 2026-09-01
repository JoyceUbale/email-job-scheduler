import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/smtp';
import { checkAndIncrementRateLimit } from '../lib/rate-limiter';
import { sendSlackRateLimitNotification } from '../lib/slack';
import { indexEmail, updateEmailIndex } from '../lib/elasticsearch';
import { EMAIL_QUEUE_NAME, EmailJobData, rescheduleEmailJob } from './email-queue';

/**
 * BullMQ Worker — processes email jobs from the queue.
 *
 * Worker concurrency is configurable via the WORKER_CONCURRENCY environment variable.
 * This allows scaling the number of concurrent job processors without code changes.
 */

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { jobId, userId, senderConfigId, senderEmail, senderName, recipient, subject, body, hourlyLimit } = job.data;

  console.log(`[Worker] Processing job ${jobId} — to: ${recipient}, subject: "${subject}"`);

  // ─── 1. Rate limit check (Redis sliding counter) ───────────────────
  const rateLimitResult = await checkAndIncrementRateLimit(senderConfigId, hourlyLimit);

  if (!rateLimitResult.allowed) {
    // Rate limit exceeded — reschedule to next hour window
    const retryAfter = rateLimitResult.retryAfter!;

    console.log(
      `[Worker] Rate limit exceeded for sender ${senderEmail} (${rateLimitResult.currentCount}/${rateLimitResult.limit}). Rescheduling job ${jobId} to ${retryAfter.toISOString()}`
    );

    // Trigger Slack notification (bypasses gracefully if not connected)
    await sendSlackRateLimitNotification({
      userId,
      senderEmail,
      message: `Sender *${senderEmail}* has reached the hourly limit of ${rateLimitResult.limit} emails. Job for *${recipient}* has been rescheduled to ${retryAfter.toISOString()}.`,
    });

    // Reschedule the job to the next hour window using BullMQ delayed jobs
    await rescheduleEmailJob(job.data, retryAfter);

    // Update the database record
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        scheduledFor: retryAfter,
        slackNotified: true,
      },
    });

    // Update Elasticsearch index
    await updateEmailIndex(jobId, {
      status: 'pending',
      scheduledFor: retryAfter.toISOString(),
    });

    // Return without throwing — the job is rescheduled, not failed
    return;
  }

  // ─── 2. Send email via SMTP (Ethereal Email) ────────────────────────
  const result = await sendEmail({
    from: senderEmail,
    fromName: senderName,
    to: recipient,
    subject,
    body,
  });

  if (!result.success) {
    // Mark as failed in DB and ES, then throw to trigger BullMQ retry
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: result.error,
      },
    });

    await updateEmailIndex(jobId, {
      status: 'failed',
    });

    throw new Error(`SMTP send failed: ${result.error}`);
  }

  // ─── 3. Update database record ─────────────────────────────────────
  await prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });

  // ─── 4. Update Elasticsearch index ──────────────────────────────────
  await updateEmailIndex(jobId, {
    status: 'sent',
    sentAt: new Date().toISOString(),
  });

  console.log(`[Worker] Job ${jobId} completed — email sent to ${recipient}`);
}

export function startWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: redis,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('ready', () => {
    console.log(`[Worker] Email worker started (concurrency: ${WORKER_CONCURRENCY})`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  return worker;
}
