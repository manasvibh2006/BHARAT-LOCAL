import { db, FeedFilterOptions } from '../../db/database-adapter';
import { cacheService } from '../../cache/cache-service';
import { CACHE_KEYS, SUPPORTED_LANGUAGES, POST_CATEGORIES } from '../../config/constants';
import { AuthUser } from '../../middleware/auth';

export class FeedService {
  public static async getFeed(opts: FeedFilterOptions, user?: AuthUser) {
    // If city is not specified, prefer user's preferred city or default to Jaipur/Bengaluru
    const city = opts.city || user?.city || 'Jaipur';
    const locality = opts.locality || undefined;
    const category = opts.category || undefined;
    const language = opts.language && opts.language !== 'all' ? opts.language : (opts.language === 'all' ? undefined : (user?.preferred_language || undefined));
    const page = opts.page || 1;
    const limit = opts.limit || 10;
    const sort = opts.sort || 'latest';

    const cacheKey = CACHE_KEYS.feed(city, locality, category, language, page);

    // Only cache standard 'latest' queries
    if (sort === 'latest') {
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        return {
          ...cached,
          meta: {
            ...cached.meta,
            cached: true,
            cacheEngine: cacheService.getCacheStats().type
          }
        };
      }
    }

    const result = await db.getFeedPosts({
      city,
      locality,
      pincode: opts.pincode,
      category,
      language,
      page,
      limit,
      sort
    });

    const response = {
      posts: result.posts,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalItems: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1
      },
      filters: {
        city,
        locality: locality || 'all',
        category: category || 'all',
        language: language || 'all',
        sort
      },
      meta: {
        cached: false,
        cacheEngine: cacheService.getCacheStats().type
      }
    };

    if (sort === 'latest') {
      await cacheService.set(cacheKey, response, 180); // cache for 3 minutes
    }

    return response;
  }

  public static getCategories() {
    return POST_CATEGORIES;
  }

  public static getLanguages() {
    return SUPPORTED_LANGUAGES;
  }
}
