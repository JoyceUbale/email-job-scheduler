import { prisma } from '../lib/prisma';
import { scheduleEmailJob, EmailJobData } from './email-queue';
import { indexEmail } from '../lib/elasticsearch';

/**
 * Scheduler Service
 *
 * This service is responsible for creating email jobs from incoming campaign requests
 * and adding them to the BullMQ queue as delayed jobs.
 *
 * Key design decisions:
 * - Uses BullMQ delayed jobs (queue.add(name, data, { delay })) — NOT cron jobs or node-cron.
 * - Each lead in a campaign gets its own delayed job with an incremental delay
 *   based on the delay_seconds setting.
 * - Jobs are staggered: lead 0 fires at start_time, lead 1 fires at start_time + delay_seconds,
 *   lead 2 fires at start_time + 2 * delay_seconds, etc.
 * - The hourly limit is enforced at the worker level via Redis sliding counters,
 *   not at scheduling time, because limits must be enforced across all concurrent workers.
 */

export interface ScheduleCampaignParams {
  userId: string;
  senderConfigId: string;
  subject: string;
  body: string;
  startTime: Date;
  delaySeconds: number;
  hourlyLimit: number;
  leads: string[];
}

export async function scheduleCampaign(
  params: ScheduleCampaignParams
): Promise<{ campaignId: string; scheduledCount: number }> {
  const { userId, senderConfigId, subject, body, startTime, delaySeconds, hourlyLimit, leads } = params;

  // Get the sender config for sender email and name
  const senderConfig = await prisma.senderConfig.findUnique({
    where: { id: senderConfigId },
  });

  if (!senderConfig) {
    throw new Error(`Sender config not found: ${senderConfigId}`);
  }

  const campaignId = crypto.randomUUID();

  // Create a job for each lead with incremental delay
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const scheduledFor = new Date(startTime.getTime() + i * delaySeconds * 1000);

    // Create database record
    const emailJob = await prisma.emailJob.create({
      data: {
        userId,
        senderConfigId,
        recipient: lead,
        subject,
        body,
        status: 'pending',
        scheduledFor,
        delaySeconds,
        hourlyLimit,
        leadCount: leads.length,
      },
    });

    // Index in Elasticsearch
    await indexEmail({
      jobId: emailJob.id,
      userId,
      recipient: lead,
      subject,
      body,
      status: 'pending',
      senderEmail: senderConfig.senderEmail,
      scheduledFor: scheduledFor.toISOString(),
      delaySeconds,
      hourlyLimit,
      leadCount: leads.length,
      createdAt: emailJob.createdAt.toISOString(),
    });

    // Add to BullMQ queue as a delayed job
    const jobData: EmailJobData = {
      jobId: emailJob.id,
      userId,
      senderConfigId,
      senderEmail: senderConfig.senderEmail,
      senderName: senderConfig.senderName,
      recipient: lead,
      subject,
      body,
      hourlyLimit,
      delaySeconds,
      leadCount: leads.length,
    };

    await scheduleEmailJob(jobData, scheduledFor);
  }

  console.log(
    `[Scheduler] Campaign ${campaignId} created — ${leads.length} jobs scheduled, starting at ${startTime.toISOString()}`
  );

  return { campaignId, scheduledCount: leads.length };
}
