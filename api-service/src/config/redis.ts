import { createClient } from 'redis';

export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => console.error('Redis Client Error', err));

export const connectRedis = async () => {
  await redisClient.connect().catch(console.error);
};
