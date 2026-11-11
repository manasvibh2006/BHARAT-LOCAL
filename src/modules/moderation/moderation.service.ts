import { db } from '../../db/database-adapter';
import { notificationQueue } from '../../queue/notification-queue';
import { cacheService } from '../../cache/cache-service';
import { AuthUser } from '../../middleware/auth';
import { memoryDb } from '../../db/memory-db';

export class ModerationService {
  public static async getReportsQueue(status: string = 'pending') {
    return db.getModerationQueue(status);
  }

  public static async moderatePost(postId: string, moderator: AuthUser, action: any, notes?: string) {
    const postBefore = await db.getPostById(postId);
    if (!postBefore) {
      throw new Error('Post not found');
    }

    const { post, actionLog } = await db.moderatePost({
      postId,
      moderatorId: moderator.id,
      action,
      notes
    });

    // Invalidate post cache
    await cacheService.del(`post:${postId}`);
    await cacheService.invalidateFeed(post.city);

    // Queue asynchronous notifications based on action taken
    if (action === 'approved' || action === 'restored') {
      notificationQueue.enqueue('POST_APPROVED', {
        postId: post.id,
        postTitle: post.title,
        authorId: post.author_id,
        moderatorName: moderator.name,
        notes,
        city: post.city
      });
    } else if (action === 'rejected') {
      notificationQueue.enqueue('POST_REJECTED', {
        postId: post.id,
        postTitle: post.title,
        authorId: post.author_id,
        moderatorName: moderator.name,
        notes,
        city: post.city
      });
    } else if (action === 'hidden') {
      notificationQueue.enqueue('POST_HIDDEN', {
        postId: post.id,
        postTitle: post.title,
        authorId: post.author_id,
        moderatorName: moderator.name,
        notes,
        city: post.city
      });
    }

    return {
      message: `Post ${action} successfully by moderator ${moderator.name}.`,
      post,
      actionLog
    };
  }

  public static async broadcastAlert(admin: AuthUser, data: { title: string; message: string; city: string; level: string }) {
    // Dispatch asynchronous broadcast to the queue
    const job = notificationQueue.enqueue('EMERGENCY_BROADCAST', {
      adminId: admin.id,
      adminName: admin.name,
      title: data.title,
      message: data.message,
      city: data.city,
      level: data.level
    });

    return {
      message: `Emergency broadcast enqueued for distribution across ${data.city}.`,
      jobId: job.id
    };
  }

  public static async getCommunityStats() {
    const reports = await db.getModerationQueue('pending');
    const allPosts = Array.from(memoryDb.posts.values());
    const activePosts = allPosts.filter((p) => p.status === 'active').length;
    const flaggedPosts = allPosts.filter((p) => p.status === 'flagged').length;
    const cacheStats = cacheService.getCacheStats();
    const queueStats = notificationQueue.getStats();

    return {
      activePosts,
      flaggedPosts,
      pendingReports: reports.length,
      totalUsers: memoryDb.users.size,
      cacheStats,
      queueStats
    };
  }
}
