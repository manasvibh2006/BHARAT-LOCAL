import { z } from 'zod';

export const ModerateActionSchema = z.object({
  action: z.enum(['approved', 'rejected', 'hidden', 'restored', 'user_banned'], {
    errorMap: () => ({ message: 'Action must be one of: approved, rejected, hidden, restored, user_banned' })
  }),
  notes: z.string().max(1000).optional()
});

export const BroadcastAlertSchema = z.object({
  title: z.string().trim().min(5).max(200),
  message: z.string().trim().min(10).max(2000),
  city: z.string().trim().min(2),
  level: z.enum(['info', 'warning', 'emergency']).default('info')
});

export const UserBanSchema = z.object({
  userId: z.string().uuid('Invalid user UUID format'),
  reason: z.string().min(5).max(500)
});
