import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { searchEmails } from '../lib/elasticsearch';

const router = Router();

/**
 * GET /api/emails/scheduled
 *
 * Returns all scheduled (pending) email jobs for a given user.
 */
router.get('/emails/scheduled', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ emails: [], message: 'userId is required' });
    }

    const emails = await prisma.emailJob.findMany({
      where: { userId, status: 'pending' },
      orderBy: { scheduledFor: 'asc' },
    });

    return res.status(200).json({ emails });
  } catch (err) {
    console.error('[Route] GET /emails/scheduled error:', err);
    return res.status(200).json({ emails: [] });
  }
});

/**
 * GET /api/emails/sent
 *
 * Returns all sent email jobs for a given user.
 */
router.get('/emails/sent', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ emails: [], message: 'userId is required' });
    }

    const emails = await prisma.emailJob.findMany({
      where: { userId, status: 'sent' },
      orderBy: { sentAt: 'desc' },
    });

    return res.status(200).json({ emails });
  } catch (err) {
    console.error('[Route] GET /emails/sent error:', err);
    return res.status(200).json({ emails: [] });
  }
});

/**
 * GET /api/emails/search
 *
 * Full-text search across sent and scheduled emails using Elasticsearch.
 * Searches subject, body, recipient, and recipientName fields with fuzzy matching.
 */
router.get('/emails/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const userId = req.query.userId as string | undefined;
    const status = req.query.status as string | undefined;
    const from = req.query.from ? parseInt(req.query.from as string, 10) : 0;
    const size = req.query.size ? parseInt(req.query.size as string, 10) : 20;

    const result = await searchEmails(query, { userId, status, from, size });

    return res.status(200).json({
      success: true,
      query,
      total: result.total,
      from,
      size,
      results: result.hits,
    });
  } catch (err) {
    console.error('[Route] GET /emails/search error:', err);
    return res.status(500).json({
      success: false,
      message: 'Search failed',
      results: [],
      total: 0,
    });
  }
});

export default router;
