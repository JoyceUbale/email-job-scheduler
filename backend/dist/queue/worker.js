"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmailJob = processEmailJob;
exports.startWorker = startWorker;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
const prisma_1 = require("../lib/prisma");
const smtp_1 = require("../lib/smtp");
const rate_limiter_1 = require("../lib/rate-limiter");
const slack_1 = require("../lib/slack");
const elasticsearch_1 = require("../lib/elasticsearch");
const email_queue_1 = require("./email-queue");
/**
 * BullMQ Worker — processes email jobs from the queue.
 *
 * Worker concurrency is configurable via the WORKER_CONCURRENCY environment variable.
 * This allows scaling the number of concurrent job processors without code changes.
 */
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
async function processEmailJob(job) {
    const { jobId, userId, senderConfigId, senderEmail, senderName, recipient, subject, body, hourlyLimit } = job.data;
    console.log(`[Worker] Processing job ${jobId} — to: ${recipient}, subject: "${subject}"`);
    // ─── 1. Rate limit check (Redis sliding counter) ───────────────────
    const rateLimitResult = await (0, rate_limiter_1.checkAndIncrementRateLimit)(senderConfigId, hourlyLimit);
    if (!rateLimitResult.allowed) {
        // Rate limit exceeded — reschedule to next hour window
        const retryAfter = rateLimitResult.retryAfter;
        console.log(`[Worker] Rate limit exceeded for sender ${senderEmail} (${rateLimitResult.currentCount}/${rateLimitResult.limit}). Rescheduling job ${jobId} to ${retryAfter.toISOString()}`);
        // Trigger Slack notification (bypasses gracefully if not connected)
        await (0, slack_1.sendSlackRateLimitNotification)({
            userId,
            senderEmail,
            message: `Sender *${senderEmail}* has reached the hourly limit of ${rateLimitResult.limit} emails. Job for *${recipient}* has been rescheduled to ${retryAfter.toISOString()}.`,
        });
        // Reschedule the job to the next hour window using BullMQ delayed jobs
        await (0, email_queue_1.rescheduleEmailJob)(job.data, retryAfter);
        // Update the database record
        await prisma_1.prisma.emailJob.update({
            where: { id: jobId },
            data: {
                scheduledFor: retryAfter,
                slackNotified: true,
            },
        });
        // Update Elasticsearch index
        await (0, elasticsearch_1.updateEmailIndex)(jobId, {
            status: 'pending',
            scheduledFor: retryAfter.toISOString(),
        });
        // Return without throwing — the job is rescheduled, not failed
        return;
    }
    // ─── 2. Send email via SMTP (Ethereal Email) ────────────────────────
    const result = await (0, smtp_1.sendEmail)({
        from: senderEmail,
        fromName: senderName,
        to: recipient,
        subject,
        body,
    });
    if (!result.success) {
        // Mark as failed in DB and ES, then throw to trigger BullMQ retry
        await prisma_1.prisma.emailJob.update({
            where: { id: jobId },
            data: {
                status: 'failed',
                errorMessage: result.error,
            },
        });
        await (0, elasticsearch_1.updateEmailIndex)(jobId, {
            status: 'failed',
        });
        throw new Error(`SMTP send failed: ${result.error}`);
    }
    // ─── 3. Update database record ─────────────────────────────────────
    await prisma_1.prisma.emailJob.update({
        where: { id: jobId },
        data: {
            status: 'sent',
            sentAt: new Date(),
        },
    });
    // ─── 4. Update Elasticsearch index ──────────────────────────────────
    await (0, elasticsearch_1.updateEmailIndex)(jobId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
    });
    console.log(`[Worker] Job ${jobId} completed — email sent to ${recipient}`);
}
function startWorker() {
    const worker = new bullmq_1.Worker(email_queue_1.EMAIL_QUEUE_NAME, processEmailJob, {
        connection: redis_1.redis,
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
//# sourceMappingURL=worker.js.map