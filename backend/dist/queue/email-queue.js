"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueueEvents = exports.emailQueue = exports.EMAIL_QUEUE_NAME = void 0;
exports.scheduleEmailJob = scheduleEmailJob;
exports.rescheduleEmailJob = rescheduleEmailJob;
const bullmq_1 = require("bullmq");
const redis_1 = require("../lib/redis");
/**
 * BullMQ Queue definition
 *
 * Uses Redis-backed delayed jobs (queue.add(name, data, { delay })) — NOT cron jobs.
 * Each email is added as a delayed job that fires at its scheduled time.
 */
exports.EMAIL_QUEUE_NAME = 'email-queue';
exports.emailQueue = new bullmq_1.Queue(exports.EMAIL_QUEUE_NAME, {
    connection: redis_1.redis,
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
exports.emailQueueEvents = new bullmq_1.QueueEvents(exports.EMAIL_QUEUE_NAME, {
    connection: redis_1.redis,
});
exports.emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[Queue] Job ${jobId} failed: ${failedReason}`);
});
exports.emailQueueEvents.on('completed', ({ jobId }) => {
    console.log(`[Queue] Job ${jobId} completed`);
});
/**
 * Add a single email job to the queue with a delay.
 * The delay is calculated as the difference between the scheduled time and now.
 * Uses BullMQ's native delayed jobs — queue.add(name, data, { delay }).
 */
async function scheduleEmailJob(data, scheduledFor) {
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    await exports.emailQueue.add('send-email', data, {
        delay,
        jobId: data.jobId,
    });
    console.log(`[Queue] Scheduled job ${data.jobId} for ${scheduledFor.toISOString()} (delay: ${delay}ms) — recipient: ${data.recipient}`);
}
/**
 * Reschedule a job to a new time (used when rate limit is exceeded).
 * Removes the old job and adds a new one with the updated delay.
 */
async function rescheduleEmailJob(data, newScheduledFor) {
    const delay = Math.max(0, newScheduledFor.getTime() - Date.now());
    await exports.emailQueue.add('send-email', data, {
        delay,
        jobId: `${data.jobId}-retry-${Date.now()}`,
    });
    console.log(`[Queue] Rescheduled job ${data.jobId} to ${newScheduledFor.toISOString()} (delay: ${delay}ms)`);
}
//# sourceMappingURL=email-queue.js.map