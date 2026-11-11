import { Response, NextFunction } from 'express';
import { PostsService } from './posts.service';
import { AuthenticatedRequest } from '../../middleware/auth';

export class PostsController {
  public static async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const post = await PostsService.createPost(req.user!, req.body);
      res.status(201).json({
        success: true,
        message: 'Community post created successfully.',
        data: post
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPostById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const postId = req.params.id as string;
      const post = await PostsService.getPostById(postId);
      res.status(200).json({
        success: true,
        data: post
      });
    } catch (err: any) {
      if (err.message === 'Post not found') {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found.' } });
        return;
      }
      next(err);
    }
  }

  public static async updatePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const postId = req.params.id as string;
      const updated = await PostsService.updatePost(postId, req.user!, req.body);
      res.status(200).json({
        success: true,
        message: 'Post updated successfully.',
        data: updated
      });
    } catch (err: any) {
      if (err.status === 403) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      next(err);
    }
  }

  public static async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const postId = req.params.id as string;
      await PostsService.deletePost(postId, req.user!);
      res.status(200).json({
        success: true,
        message: 'Post deleted successfully.'
      });
    } catch (err: any) {
      if (err.status === 403) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: err.message } });
        return;
      }
      next(err);
    }
  }

  public static async reportPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const postId = req.params.id as string;
      const result = await PostsService.reportPost(postId, req.user!, req.body);
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          report: result.report,
          isFlagged: result.isFlagged
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
}
