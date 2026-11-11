import { Response, NextFunction } from 'express';
import { ModerationService } from './moderation.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export class ModerationController {
  public static async getReportsQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = (req.query.status as string) || 'pending';
      const queue = await ModerationService.getReportsQueue(status);
      res.status(200).json({
        success: true,
        data: queue
      });
    } catch (err) {
      next(err);
    }
  }

  public static async moderatePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { action, notes } = req.body;
      const postId = req.params.id as string;
      const result = await ModerationService.moderatePost(postId, req.user!, action, notes);
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          post: result.post,
          actionLog: result.actionLog
        }
      });
    } catch (err: any) {
      if (err.message === 'Post not found') {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found.' } });
        return;
      }
      next(err);
    }
  }

  public static async broadcastAlert(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ModerationService.broadcastAlert(req.user!, req.body);
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          jobId: result.jobId
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await ModerationService.getCommunityStats();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }
}
