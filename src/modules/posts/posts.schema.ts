import { z } from 'zod';
import { REPORT_REASONS } from '../../config/constants';

const pincodeRegex = /^[1-9][0-9]{5}$/;

export const CreatePostSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters long')
    .max(250, 'Title cannot exceed 250 characters'),
  content: z
    .string()
    .trim()
    .min(10, 'Content must be at least 10 characters long')
    .max(5000, 'Content cannot exceed 5000 characters'),
  category_id: z.string().min(1, 'Category is required'),
  language: z.enum(['hi', 'en', 'ta', 'te', 'kn', 'mr', 'bn', 'gu', 'ml', 'pa']).default('hi'),
  state: z.string().min(2, 'State is required'),
  city: z.string().min(2, 'City is required'),
  locality: z.string().optional(),
  pincode: z.string().regex(pincodeRegex, 'Pincode must be a valid 6-digit Indian PIN code'),
  contact_info: z.string().max(150).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});

export const UpdatePostSchema = z.object({
  title: z.string().trim().min(5).max(250).optional(),
  content: z.string().trim().min(10).max(5000).optional(),
  category_id: z.string().optional(),
  language: z.enum(['hi', 'en', 'ta', 'te', 'kn', 'mr', 'bn', 'gu', 'ml', 'pa']).optional(),
  locality: z.string().optional(),
  contact_info: z.string().max(150).optional()
});

export const ReportPostSchema = z.object({
  reason: z.enum(REPORT_REASONS, {
    errorMap: () => ({ message: `Reason must be one of: ${REPORT_REASONS.join(', ')}` })
  }),
  details: z.string().max(1000).optional()
});
