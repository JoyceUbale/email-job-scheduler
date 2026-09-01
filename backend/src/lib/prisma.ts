import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[Prisma] Database connected');
  } catch (err) {
    console.error('[Prisma] Failed to connect:', err);
    throw err;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  console.log('[Prisma] Database disconnected');
}
