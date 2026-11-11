import { Response, NextFunction } from 'express';
import { FeedService } from './feed.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export class FeedController {
  public static async getFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const feed = await FeedService.getFeed(req.query as any, req.user);
      res.status(200).json({
        success: true,
        data: feed
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getCategories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const categories = FeedService.getCategories();
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getLanguages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const languages = FeedService.getLanguages();
      res.status(200).json({
        success: true,
        data: languages
      });
    } catch (err) {
      next(err);
    }
  }
}
