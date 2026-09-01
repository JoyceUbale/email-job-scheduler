import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { scheduleCampaign } from '../queue/scheduler';

const router = Router();

const ScheduleEmailSchema = z.object({
  userId: z.string().uuid(),
  senderConfigId: z.string().uuid(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  startTime: z.string().min(1, 'Start time is required'),
  delaySeconds: z.number().int().min(0).default(60),
  hourlyLimit: z.number().int().min(1).default(30),
  leads: z.array(z.string().email()).min(1, 'At least one lead is required'),
});

/**
 * POST /api/schedule-email
 *
 * Accepts a campaign payload, validates it, creates EmailJob records in the database,
 * indexes them in Elasticsearch, and adds them to the BullMQ queue as delayed jobs.
 */
router.post('/schedule-email', async (req: Request, res: Response) => {
  try {
    const parsed = ScheduleEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { userId, senderConfigId, subject, body, startTime, delaySeconds, hourlyLimit, leads } =
      parsed.data;

    // Verify the sender config belongs to the user
    const senderConfig = await prisma.senderConfig.findFirst({
      where: { id: senderConfigId, userId },
    });

    if (!senderConfig) {
      return res.status(404).json({
        success: false,
        message: 'Sender configuration not found for this user',
      });
    }

    const result = await scheduleCampaign({
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Route] POST /schedule-email error:', message);
    return res.status(500).json({ success: false, message });
  }
});

export default router;
