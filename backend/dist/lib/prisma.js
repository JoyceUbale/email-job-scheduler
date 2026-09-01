"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectPrisma = connectPrisma;
exports.disconnectPrisma = disconnectPrisma;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});
async function connectPrisma() {
    try {
        await exports.prisma.$connect();
        console.log('[Prisma] Database connected');
    }
    catch (err) {
        console.error('[Prisma] Failed to connect:', err);
        throw err;
    }
}
async function disconnectPrisma() {
    await exports.prisma.$disconnect();
    console.log('[Prisma] Database disconnected');
}
//# sourceMappingURL=prisma.js.map