import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

connection.on('error', (err) => {
  console.error('Redis Connection Error:', err.message);
});

export const reconciliationQueue = new Queue('reconciliation', {
  connection
});

export const bullConnection = connection;