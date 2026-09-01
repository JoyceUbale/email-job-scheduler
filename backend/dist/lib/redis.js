"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
exports.redis = new ioredis_1.default({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
});
exports.redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});
exports.redis.on('connect', () => {
    console.log(`[Redis] Connected to ${redisHost}:${redisPort}`);
});
//# sourceMappingURL=redis.js.map