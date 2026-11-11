import { notificationQueue, NotificationJob } from './notification-queue';
import { db } from '../db/database-adapter';
import { cacheService } from '../cache/cache-service';

export class NotificationWorker {
  private static isRunning = false;

  public static start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('👷 Background Notification Worker initialized and listening for jobs...');

    notificationQueue.registerWorker(async (job: NotificationJob) => {
      await this.processJob(job);
    });
  }

  private static async processJob(job: NotificationJob): Promise<void> {
    const { type, payload } = job;
    console.log(`[Worker] ⚙️ Processing async job [${job.id}] Type: ${type}`);

    switch (type) {
      case 'POST_REPORTED': {
        const { postId, postTitle, reporterId, reporterName, reason, details, city } = payload;
        
        // Find community moderators & admins
        const moderatorsAndAdmins = db.getAllModeratorsAndAdmins();

        for (const mod of moderatorsAndAdmins) {
          await db.createNotification({
            recipient_id: mod.id,
            type: 'MODERATION_ALERT',
            title: `⚠️ Post Reported in ${city}: "${postTitle.substring(0, 40)}..."`,
            message: `User ${reporterName || 'Resident'} reported this post for "${reason}". Details: "${details || 'No additional note'}". Please review in the Moderation Queue.`,
            payload: {
              postId,
              reason,
              reporterId
            }
          });
        }

        console.log(`[Worker] ✅ Sent moderation alerts to ${moderatorsAndAdmins.length} moderators/admins for post ${postId}`);
        break;
      }

      case 'POST_APPROVED': {
        const { postId, postTitle, authorId, moderatorName, notes, city } = payload;
        
        // Notify the author
        await db.createNotification({
          recipient_id: authorId,
          type: 'POST_STATUS_UPDATE',
          title: `✅ Your post has been approved!`,
          message: `Good news! Your community post "${postTitle}" was reviewed and approved by moderator ${moderatorName || 'Team'}. It is now live in the local feed.`,
          payload: { postId, status: 'active', notes }
        });

        // Invalidate feed cache for this city
        await cacheService.invalidateFeed(city);
        console.log(`[Worker] ✅ Post ${postId} approved notification sent to author ${authorId}. Cache invalidated for city: ${city}`);
        break;
      }

      case 'POST_REJECTED': {
        const { postId, postTitle, authorId, moderatorName, notes, city } = payload;
        
        await db.createNotification({
          recipient_id: authorId,
          type: 'POST_REJECTED',
          title: `❌ Post Moderation Notice`,
          message: `Your community post "${postTitle}" was reviewed and rejected. Reason: ${notes || 'Violates community guidelines'}.`,
          payload: { postId, status: 'rejected', notes }
        });

        await cacheService.invalidateFeed(city);
        console.log(`[Worker] ✅ Post ${postId} rejection notification sent to author ${authorId}`);
        break;
      }

      case 'POST_HIDDEN': {
        const { postId, postTitle, authorId, moderatorName, notes, city } = payload;
        
        await db.createNotification({
          recipient_id: authorId,
          type: 'POST_HIDDEN',
          title: `⚠️ Post Temporarily Hidden`,
          message: `Your community post "${postTitle}" has been temporarily hidden pending further review. Notes: ${notes || 'Community safety'}.`,
          payload: { postId, status: 'hidden', notes }
        });

        await cacheService.invalidateFeed(city);
        break;
      }

      case 'EMERGENCY_BROADCAST': {
        const { title, message, city } = payload;
        // In real life, could push via FCM / Twilio SMS. Here we record to local DB and log
        console.log(`[Worker] 🚨 EMERGENCY BROADCAST to city [${city}]: "${title}" - ${message}`);
        await cacheService.invalidateFeed(city);
        break;
      }

      default:
        console.warn(`[Worker] Unknown job type: ${type}`);
    }
  }
}
