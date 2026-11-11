import { db } from '../../db/database-adapter';

export class SearchService {
  public static async search(params: {
    q: string;
    city?: string;
    category?: string;
    language?: string;
    page?: number;
    limit?: number;
    sort?: 'latest' | 'oldest' | 'popular';
  }) {
    const result = await db.searchPosts({
      query: params.q,
      city: params.city,
      category: params.category,
      language: params.language,
      page: params.page || 1,
      limit: params.limit || 10,
      sort: params.sort || 'latest'
    });

    return {
      query: params.q,
      posts: result.posts,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalItems: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1
      }
    };
  }
}
