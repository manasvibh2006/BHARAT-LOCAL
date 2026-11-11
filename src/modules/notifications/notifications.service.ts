import { db } from '../../db/database-adapter';
import { notificationQueue } from '../../queue/notification-queue';

export class NotificationsService {
  public static async getUserNotifications(userId: string) {
    return db.getUserNotifications(userId, 30);
  }

  public static async markRead(notificationId: string, userId: string) {
    return db.markNotificationRead(notificationId, userId);
  }

  public static getQueueStatus() {
    return notificationQueue.getStats();
  }
}
