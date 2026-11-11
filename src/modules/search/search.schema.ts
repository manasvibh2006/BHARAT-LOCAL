import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required'),
  city: z.string().trim().optional(),
  category: z.string().trim().optional(),
  language: z.enum(['hi', 'en', 'ta', 'te', 'kn', 'mr', 'bn', 'gu', 'ml', 'pa', 'all']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['latest', 'oldest', 'popular']).default('latest')
});
