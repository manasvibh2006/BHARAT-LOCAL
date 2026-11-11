import { getRedisClient, isRedisConnected, localCache } from './redis';
import { ENV } from '../config/env';

export class CacheService {
  private static instance: CacheService;

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        const data = await client?.get(key);
        if (data) return JSON.parse(data);
      }
    } catch (err) {
      // Fallback
    }

    const localData = localCache.get(key);
    if (localData) {
      try {
        return JSON.parse(localData);
      } catch {
        return null;
      }
    }
    return null;
  }

  public async set(key: string, value: any, ttlSeconds: number = ENV.REDIS_CACHE_TTL_SECONDS): Promise<void> {
    const serialized = JSON.stringify(value);
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        await client?.setex(key, ttlSeconds, serialized);
      }
    } catch (err) {
      // Fallback
    }
    localCache.set(key, serialized, ttlSeconds);
  }

  public async del(key: string): Promise<void> {
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        await client?.del(key);
      }
    } catch (err) {
      // Fallback
    }
    localCache.del(key);
  }

  public async invalidateFeed(city?: string): Promise<void> {
    const pattern = city ? `feed:${city.toLowerCase()}*` : 'feed:*';
    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        if (client) {
          const keys = await client.keys(pattern);
          if (keys.length > 0) {
            await client.del(...keys);
          }
        }
      }
    } catch (err) {
      // Fallback
    }
    localCache.deletePattern(pattern);
  }

  public getCacheStats() {
    return {
      type: isRedisConnected() ? 'redis' : 'in-memory',
      hits: localCache.stats.hits,
      misses: localCache.stats.misses,
      cachedKeys: localCache.size()
    };
  }
}

export const cacheService = CacheService.getInstance();
