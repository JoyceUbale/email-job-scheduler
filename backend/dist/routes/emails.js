"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const elasticsearch_1 = require("../lib/elasticsearch");
const router = (0, express_1.Router)();
/**
 * GET /api/emails/scheduled
 *
 * Returns all scheduled (pending) email jobs for a given user.
 */
router.get('/emails/scheduled', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ emails: [], message: 'userId is required' });
        }
        const emails = await prisma_1.prisma.emailJob.findMany({
            where: { userId, status: 'pending' },
            orderBy: { scheduledFor: 'asc' },
        });
        return res.status(200).json({ emails });
    }
    catch (err) {
        console.error('[Route] GET /emails/scheduled error:', err);
        return res.status(200).json({ emails: [] });
    }
});
/**
 * GET /api/emails/sent
 *
 * Returns all sent email jobs for a given user.
 */
router.get('/emails/sent', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ emails: [], message: 'userId is required' });
        }
        const emails = await prisma_1.prisma.emailJob.findMany({
            where: { userId, status: 'sent' },
            orderBy: { sentAt: 'desc' },
        });
        return res.status(200).json({ emails });
    }
    catch (err) {
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
router.get('/emails/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const userId = req.query.userId;
        const status = req.query.status;
        const from = req.query.from ? parseInt(req.query.from, 10) : 0;
        const size = req.query.size ? parseInt(req.query.size, 10) : 20;
        const result = await (0, elasticsearch_1.searchEmails)(query, { userId, status, from, size });
        return res.status(200).json({
            success: true,
            query,
            total: result.total,
            from,
            size,
            results: result.hits,
        });
    }
    catch (err) {
        console.error('[Route] GET /emails/search error:', err);
        return res.status(500).json({
            success: false,
            message: 'Search failed',
            results: [],
            total: 0,
        });
    }
});
exports.default = router;
//# sourceMappingURL=emails.js.map