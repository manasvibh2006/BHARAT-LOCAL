import Redis from 'ioredis';
import { ENV } from '../config/env';

export let redisClient: Redis | null = null;
let isRedisAvailable = false;

// High-speed fallback in-memory cache with TTL support
class MemoryCache {
  private store: Map<string, { value: string; expiresAt: number }> = new Map();
  public stats = { hits: 0, misses: 0 };

  get(key: string): string | null {
    const item = this.store.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return item.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  deletePattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let deleted = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const localCache = new MemoryCache();

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(ENV.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => null // don't loop endlessly in development
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      console.log('⚡ Connected to Redis Cache & Queue engine');
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      // Soft warning
    });

    return redisClient;
  } catch (err: any) {
    isRedisAvailable = false;
    return null;
  }
}

export async function testRedisConnection(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    const pong = await client.ping();
    isRedisAvailable = pong === 'PONG';
    return isRedisAvailable;
  } catch (err) {
    isRedisAvailable = false;
    return false;
  }
}

export function isRedisConnected(): boolean {
  return isRedisAvailable;
}
