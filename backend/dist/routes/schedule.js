"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const scheduler_1 = require("../queue/scheduler");
const router = (0, express_1.Router)();
const ScheduleEmailSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    senderConfigId: zod_1.z.string().uuid(),
    subject: zod_1.z.string().min(1, 'Subject is required'),
    body: zod_1.z.string().min(1, 'Body is required'),
    startTime: zod_1.z.string().min(1, 'Start time is required'),
    delaySeconds: zod_1.z.number().int().min(0).default(60),
    hourlyLimit: zod_1.z.number().int().min(1).default(30),
    leads: zod_1.z.array(zod_1.z.string().email()).min(1, 'At least one lead is required'),
});
/**
 * POST /api/schedule-email
 *
 * Accepts a campaign payload, validates it, creates EmailJob records in the database,
 * indexes them in Elasticsearch, and adds them to the BullMQ queue as delayed jobs.
 */
router.post('/schedule-email', async (req, res) => {
    try {
        const parsed = ScheduleEmailSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: parsed.error.flatten().fieldErrors,
            });
        }
        const { userId, senderConfigId, subject, body, startTime, delaySeconds, hourlyLimit, leads } = parsed.data;
        // Verify the sender config belongs to the user
        const senderConfig = await prisma_1.prisma.senderConfig.findFirst({
            where: { id: senderConfigId, userId },
        });
        if (!senderConfig) {
            return res.status(404).json({
                success: false,
                message: 'Sender configuration not found for this user',
            });
        }
        const result = await (0, scheduler_1.scheduleCampaign)({
            userId,
            senderConfigId,
            subject,
            body,
            startTime: new Date(startTime),
            delaySeconds,
            hourlyLimit,
            leads,
        });
        return res.status(200).json({
            success: true,
            campaignId: result.campaignId,
            leadCount: result.scheduledCount,
            message: `Campaign scheduled with ${result.scheduledCount} lead${result.scheduledCount === 1 ? '' : 's'}`,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        console.error('[Route] POST /schedule-email error:', message);
        return res.status(500).json({ success: false, message });
    }
});
exports.default = router;
//# sourceMappingURL=schedule.js.map