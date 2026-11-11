import { z } from 'zod';

export const MarkNotificationReadSchema = z.object({
  id: z.string().uuid()
});
