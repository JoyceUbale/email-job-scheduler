import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../services/mailer';
import { enforceHourlyRateLimit } from '../services/rateLimiter';
import { updateEmailIndex } from '../lib/elasticsearch';
import { EMAIL_QUEUE_NAME, EmailJobData } from './email-queue';

/**
 * BullMQ Worker — processes email jobs from Redis.
 * Concurrency is set via WORKER_CONCURRENCY (default 5).
 */

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { jobId, senderEmail, senderName, recipient, subject, body } = job.data;

  console.log(`[Worker] Processing job ${jobId} — to: ${recipient}, subject: "${subject}"`);

  const rateLimitResult = await enforceHourlyRateLimit(job.data);
  if (!rateLimitResult.allowed) {
    return;
  }

  const result = await sendEmail({
    from: senderEmail,
    fromName: senderName,
    to: recipient,
    subject,
    body,
  });

  if (!result.success) {
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

  await prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: 'sent',
      sentAt: new Date(),
    },
  });

  await updateEmailIndex(jobId, {
    status: 'sent',
    sentAt: new Date().toISOString(),
  });

  console.log(`[Worker] Job ${jobId} completed — email sent to ${recipient}`);
}

export function startWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: redis,
    concurrency: WORKER_CONCURRENCY,
  });

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
