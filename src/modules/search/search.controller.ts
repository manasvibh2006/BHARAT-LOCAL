import { Response, NextFunction } from 'express';
import { SearchService } from './search.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export class SearchController {
  public static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { q, city, category, language, page, limit, sort } = req.query as any;
      const results = await SearchService.search({
        q,
        city: city || req.user?.city,
        category,
        language,
        page,
        limit,
        sort
      });

      res.status(200).json({
        success: true,
        data: results
      });
    } catch (err) {
      next(err);
    }
  }
}
