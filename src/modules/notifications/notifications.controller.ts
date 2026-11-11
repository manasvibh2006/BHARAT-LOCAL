import { Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export class NotificationsController {
  public static async getMyNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notifs = await NotificationsService.getUserNotifications(req.user!.id);
      res.status(200).json({
        success: true,
        data: notifs
      });
    } catch (err) {
      next(err);
    }
  }

  public static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notifId = req.params.id as string;
      const success = await NotificationsService.markRead(notifId, req.user!.id);
      res.status(200).json({
        success,
        message: success ? 'Notification marked as read.' : 'Notification not found.'
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getQueueStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = NotificationsService.getQueueStatus();
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }
}
