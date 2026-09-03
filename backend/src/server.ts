import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/dist/src/queueAdapters/bullMQ';

import { connectPrisma, disconnectPrisma } from './lib/prisma';
import { connectElasticsearch } from './lib/elasticsearch';
import { startWorker } from './queue/worker';
import { emailQueue } from './queue/email-queue';
import scheduleRoutes from './routes/schedule';
import emailRoutes from './routes/emails';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', scheduleRoutes);
app.use('/api', emailRoutes);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as unknown as Parameters<typeof createBullBoard>[0]['queues'][0]],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function start(): Promise<void> {
  try {
    await connectPrisma();
    await connectElasticsearch();

    startWorker();

    app.listen(PORT, () => {
      console.log(`\n┌─────────────────────────────────────────────────┐`);
      console.log(`│  ReachInbox Backend                             │`);
      console.log(`│  Server:     http://localhost:${PORT}              │`);
      console.log(`│  Bull Board: http://localhost:${PORT}/admin/queues │`);
      console.log(`│  Worker concurrency: ${process.env.WORKER_CONCURRENCY || '5'}              │`);
      console.log(`└─────────────────────────────────────────────────┘\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();

export default app;
