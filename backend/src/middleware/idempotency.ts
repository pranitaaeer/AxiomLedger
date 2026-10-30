import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';

const TTL_SECONDS = 60 * 60 * 24;

export async function idempotency(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.header('Idempotency-Key');
    if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });

    const redisKey = `idem:${key}`;
    const lockKey = `${redisKey}:lock`;
    const existing = await redis.get(redisKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      return res.status(parsed.status).json(parsed.body);
    }

    const locked = await redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (!locked) {
      return res.status(409).json({ error: 'Duplicate request in progress' });
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      void (async () => {
        try {
          await redis.set(redisKey, JSON.stringify({ status, body }), 'EX', TTL_SECONDS);
        } catch (error) {
          console.error('Failed to cache idempotent response', error);
        } finally {
          try {
            await redis.del(lockKey);
          } catch (error) {
            console.error('Failed to release idempotency lock', error);
          }
        }
      })();
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
}