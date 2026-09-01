"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleCampaign = scheduleCampaign;
const prisma_1 = require("../lib/prisma");
const email_queue_1 = require("./email-queue");
const elasticsearch_1 = require("../lib/elasticsearch");
async function scheduleCampaign(params) {
    const { userId, senderConfigId, subject, body, startTime, delaySeconds, hourlyLimit, leads } = params;
    // Get the sender config for sender email and name
    const senderConfig = await prisma_1.prisma.senderConfig.findUnique({
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
        const emailJob = await prisma_1.prisma.emailJob.create({
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
        await (0, elasticsearch_1.indexEmail)({
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
        const jobData = {
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
        await (0, email_queue_1.scheduleEmailJob)(jobData, scheduledFor);
    }
    console.log(`[Scheduler] Campaign ${campaignId} created — ${leads.length} jobs scheduled, starting at ${startTime.toISOString()}`);
    return { campaignId, scheduledCount: leads.length };
}
//# sourceMappingURL=scheduler.js.map