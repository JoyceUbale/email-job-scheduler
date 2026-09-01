"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_2 = require("@bull-board/express");
const api_1 = require("@bull-board/api");
const bullMQ_1 = require("@bull-board/api/dist/src/queueAdapters/bullMQ");
const prisma_1 = require("./lib/prisma");
const elasticsearch_1 = require("./lib/elasticsearch");
const worker_1 = require("./queue/worker");
const email_queue_1 = require("./queue/email-queue");
const schedule_1 = __importDefault(require("./routes/schedule"));
const emails_1 = __importDefault(require("./routes/emails"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '4000', 10);
// ─── Middleware ──────────────────────────────────────────────────────
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Health check ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── API Routes ──────────────────────────────────────────────────────
app.use('/api', schedule_1.default);
app.use('/api', emails_1.default);
// ─── Bull Board Dashboard (mounted at /admin/queues) ─────────────────
const serverAdapter = new express_2.ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
(0, api_1.createBullBoard)({
    queues: [new bullMQ_1.BullMQAdapter(email_queue_1.emailQueue)],
    serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());
// ─── Graceful shutdown ───────────────────────────────────────────────
async function shutdown(signal) {
    console.log(`\n[App] Received ${signal}, shutting down gracefully...`);
    await (0, prisma_1.disconnectPrisma)();
    process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
// ─── Start server ─────────────────────────────────────────────────────
async function start() {
    try {
        await (0, prisma_1.connectPrisma)();
        await (0, elasticsearch_1.connectElasticsearch)();
        // Start the BullMQ worker
        (0, worker_1.startWorker)();
        app.listen(PORT, () => {
            console.log(`\n┌─────────────────────────────────────────────────┐`);
            console.log(`│  ReachInbox Backend                             │`);
            console.log(`│  Server:     http://localhost:${PORT}              │`);
            console.log(`│  Bull Board: http://localhost:${PORT}/admin/queues │`);
            console.log(`│  Worker concurrency: ${process.env.WORKER_CONCURRENCY || '5'}              │`);
            console.log(`└─────────────────────────────────────────────────┘\n`);
        });
    }
    catch (err) {
        console.error('[App] Failed to start:', err);
        process.exit(1);
    }
}
start();
//# sourceMappingURL=app.js.map