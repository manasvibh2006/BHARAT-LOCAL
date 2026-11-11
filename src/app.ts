import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

import fs from 'fs';

import { ENV } from './config/env';
import { db } from './db/database-adapter';
import { cacheService } from './cache/cache-service';
import { notificationQueue } from './queue/notification-queue';

// Middlewares
import { requireAuth, optionalAuth } from './middleware/auth';
import { requireModeratorOrAdmin, requireAdmin } from './middleware/rbac';
import { validateBody, validateQuery } from './middleware/validate';
import { apiRateLimiter, authRateLimiter } from './middleware/rate-limiter';
import { errorHandler } from './middleware/error-handler';

// Controllers & Schemas
import { AuthController } from './modules/auth/auth.controller';
import { RequestOtpSchema, VerifyOtpSchema, UpdateProfileSchema } from './modules/auth/auth.schema';

import { FeedController } from './modules/feed/feed.controller';
import { FeedQuerySchema } from './modules/feed/feed.schema';

import { PostsController } from './modules/posts/posts.controller';
import { CreatePostSchema, UpdatePostSchema, ReportPostSchema } from './modules/posts/posts.schema';

import { SearchController } from './modules/search/search.controller';
import { SearchQuerySchema } from './modules/search/search.schema';

import { ModerationController } from './modules/moderation/moderation.controller';
import { ModerateActionSchema, BroadcastAlertSchema } from './modules/moderation/moderation.schema';

import { NotificationsController } from './modules/notifications/notifications.controller';

import swaggerDocument from './docs/swagger.json';

export function createApp(): Express {
  const app = express();

  // Security & Logging
  app.use(helmet({
    contentSecurityPolicy: false // Allows self-contained interactive web app & swagger assets
  }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Rate Limiting on API endpoints
  app.use('/api', apiRateLimiter);

  // Serve static assets for Web UI
  const publicPath = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, '../src/public');
  app.use(express.static(publicPath));

  // Swagger Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'Bharat Local API Documentation'
  }));

  // Healthcheck endpoint
  app.get('/health', async (req, res) => {
    const dbStatus = await db.getStatus();
    const cacheStats = cacheService.getCacheStats();
    const queueStats = notificationQueue.getStats();

    res.status(200).json({
      status: 'healthy',
      app: ENV.APP_NAME,
      timestamp: new Date().toISOString(),
      database: {
        mode: dbStatus.mode,
        healthy: dbStatus.healthy
      },
      cache: cacheStats,
      backgroundQueue: {
        pendingJobs: queueStats.pendingInQueue,
        completedJobs: queueStats.totalCompleted,
        failedJobs: queueStats.totalFailed
      }
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTING (v1)
  // --------------------------------------------------------------------------
  const apiRouter = express.Router();

  // Auth Routes
  const authRouter = express.Router();
  authRouter.post('/request-otp', authRateLimiter, validateBody(RequestOtpSchema), AuthController.requestOtp);
  authRouter.post('/verify-otp', authRateLimiter, validateBody(VerifyOtpSchema), AuthController.verifyOtp);
  authRouter.get('/me', requireAuth, AuthController.getProfile);
  authRouter.put('/me', requireAuth, validateBody(UpdateProfileSchema), AuthController.updateProfile);
  authRouter.get('/demo-personas', AuthController.getDemoPersonas);
  apiRouter.use('/auth', authRouter);

  // Feed Routes
  const feedRouter = express.Router();
  feedRouter.get('/', optionalAuth, validateQuery(FeedQuerySchema), FeedController.getFeed);
  feedRouter.get('/categories', FeedController.getCategories);
  feedRouter.get('/languages', FeedController.getLanguages);
  apiRouter.use('/feed', feedRouter);

  // Posts Routes
  const postsRouter = express.Router();
  postsRouter.post('/', requireAuth, validateBody(CreatePostSchema), PostsController.createPost);
  postsRouter.get('/:id', optionalAuth, PostsController.getPostById);
  postsRouter.put('/:id', requireAuth, validateBody(UpdatePostSchema), PostsController.updatePost);
  postsRouter.delete('/:id', requireAuth, PostsController.deletePost);
  postsRouter.post('/:id/report', requireAuth, validateBody(ReportPostSchema), PostsController.reportPost);
  apiRouter.use('/posts', postsRouter);

  // Search Routes
  const searchRouter = express.Router();
  searchRouter.get('/', optionalAuth, validateQuery(SearchQuerySchema), SearchController.search);
  apiRouter.use('/search', searchRouter);

  // Moderation Routes (Moderator & Admin)
  const modRouter = express.Router();
  modRouter.get('/reports', requireAuth, requireModeratorOrAdmin, ModerationController.getReportsQueue);
  modRouter.post('/posts/:id/action', requireAuth, requireModeratorOrAdmin, validateBody(ModerateActionSchema), ModerationController.moderatePost);
  modRouter.post('/broadcast', requireAuth, requireAdmin, validateBody(BroadcastAlertSchema), ModerationController.broadcastAlert);
  modRouter.get('/stats', requireAuth, requireModeratorOrAdmin, ModerationController.getStats);
  apiRouter.use('/moderation', modRouter);

  // Notifications Routes
  const notifRouter = express.Router();
  notifRouter.get('/', requireAuth, NotificationsController.getMyNotifications);
  notifRouter.patch('/:id/read', requireAuth, NotificationsController.markAsRead);
  notifRouter.get('/queue-status', requireAuth, NotificationsController.getQueueStatus);
  apiRouter.use('/notifications', notifRouter);

  // Mount API
  app.use('/api/v1', apiRouter);

  // Catch-all 404 handler for API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`
      }
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
