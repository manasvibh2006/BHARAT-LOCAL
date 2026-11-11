import { db } from '../../db/database-adapter';
import { cacheService } from '../../cache/cache-service';
import { notificationQueue } from '../../queue/notification-queue';
import { Post, PostReport } from '../../db/schema';
import { AuthUser } from '../../middleware/auth';

export class PostsService {
  public static async createPost(author: AuthUser, data: any): Promise<Post> {
    const newPost = await db.createPost({
      author_id: author.id,
      category_id: data.category_id,
      title: data.title,
      content: data.content,
      language: data.language || author.preferred_language || 'hi',
      state: data.state || author.state,
      city: data.city || author.city,
      locality: data.locality || author.locality,
      pincode: data.pincode || author.pincode,
      latitude: data.latitude,
      longitude: data.longitude,
      contact_info: data.contact_info || author.phone
    });

    // Invalidate local feed cache
    await cacheService.invalidateFeed(newPost.city);

    return newPost;
  }

  public static async getPostById(id: string): Promise<Post> {
    // Check cache
    const cacheKey = `post:${id}`;
    const cached = await cacheService.get<Post>(cacheKey);
    if (cached) {
      // Fire and forget view count increment
      db.getPostById(id, true).catch(() => {});
      return cached;
    }

    const post = await db.getPostById(id, true);
    if (!post) {
      throw new Error('Post not found');
    }

    // Cache for 60 seconds
    await cacheService.set(cacheKey, post, 60);
    return post;
  }

  public static async updatePost(postId: string, user: AuthUser, updates: any): Promise<Post> {
    const post = await db.getPostById(postId);
    if (!post) throw new Error('Post not found');

    const isAuthor = post.author_id === user.id;
    const isModeratorOrAdmin = user.role === 'moderator' || user.role === 'admin';

    if (!isAuthor && !isModeratorOrAdmin) {
      const err: any = new Error('You do not have permission to edit this post.');
      err.status = 403;
      throw err;
    }

    const updated = await db.updatePost(postId, updates);
    if (!updated) throw new Error('Failed to update post');

    // Invalidate caches
    await cacheService.del(`post:${postId}`);
    await cacheService.invalidateFeed(updated.city);

    return updated;
  }

  public static async deletePost(postId: string, user: AuthUser): Promise<void> {
    const post = await db.getPostById(postId);
    if (!post) throw new Error('Post not found');

    const isAuthor = post.author_id === user.id;
    const isModeratorOrAdmin = user.role === 'moderator' || user.role === 'admin';

    if (!isAuthor && !isModeratorOrAdmin) {
      const err: any = new Error('You do not have permission to delete this post.');
      err.status = 403;
      throw err;
    }

    await db.deletePost(postId);
    await cacheService.del(`post:${postId}`);
    await cacheService.invalidateFeed(post.city);
  }

  public static async reportPost(postId: string, reporter: AuthUser, reportData: any): Promise<{
    message: string;
    report: PostReport;
    isFlagged: boolean;
  }> {
    const { report, post } = await db.createReport({
      post_id: postId,
      reporter_id: reporter.id,
      reason: reportData.reason,
      details: reportData.details
    });

    // Invalidate post cache
    await cacheService.del(`post:${postId}`);
    if (post.status === 'flagged') {
      await cacheService.invalidateFeed(post.city);
    }

    // Dispatch background async notification to moderators queue
    notificationQueue.enqueue('POST_REPORTED', {
      postId: post.id,
      postTitle: post.title,
      reporterId: reporter.id,
      reporterName: reporter.name,
      reason: report.reason,
      details: report.details,
      city: post.city,
      reportCount: post.report_count
    });

    return {
      message: 'Thank you for helping keep Bharat Local safe. Your report has been submitted to community moderation.',
      report,
      isFlagged: post.status === 'flagged'
    };
  }
}
