import { z } from 'zod';
import { SUPPORTED_LANGUAGES } from '../../config/constants';

const indianPhoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;

export const RequestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(indianPhoneRegex, 'Please enter a valid 10-digit Indian mobile number (+91XXXXXXXXXX or XXXXXXXXXX)')
});

export const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(indianPhoneRegex, 'Please enter a valid 10-digit Indian mobile number'),
  otp: z
    .string()
    .trim()
    .length(6, 'OTP must be exactly 6 digits'),
  // Optional registration fields if user is new
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  preferred_language: z.enum(['hi', 'en', 'ta', 'te', 'kn', 'mr', 'bn', 'gu', 'ml', 'pa']).optional(),
  state: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  locality: z.string().optional(),
  pincode: z.string().regex(pincodeRegex, 'Pincode must be a valid 6-digit Indian PIN code').optional()
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  preferred_language: z.enum(['hi', 'en', 'ta', 'te', 'kn', 'mr', 'bn', 'gu', 'ml', 'pa']).optional(),
  state: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  locality: z.string().optional(),
  pincode: z.string().regex(pincodeRegex, 'Pincode must be a valid 6-digit Indian PIN code').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional()
});
