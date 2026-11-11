import { UserRole, PostStatus, ReportReason } from '../config/constants';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  preferred_language: string;
  state: string;
  city: string;
  locality?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name_en: string;
  name_hi: string;
  translations: Record<string, string>;
  icon: string;
  is_active: boolean;
  created_at?: string;
}

export interface Post {
  id: string;
  author_id: string;
  author_name?: string;
  author_phone?: string;
  category_id: string;
  category_name?: string;
  title: string;
  content: string;
  language: string;
  state: string;
  city: string;
  locality?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  contact_info?: string;
  status: PostStatus;
  report_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostReport {
  id: string;
  post_id: string;
  reporter_id: string;
  reporter_name?: string;
  reason: ReportReason;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  post_title?: string;
  post_content?: string;
}

export interface ModerationAction {
  id: string;
  post_id: string;
  moderator_id: string;
  action: 'approved' | 'rejected' | 'hidden' | 'restored' | 'user_warned' | 'user_banned';
  notes?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, any>;
  is_read: boolean;
  delivery_status: 'pending' | 'delivered' | 'failed';
  created_at: string;
}

export interface OtpRecord {
  id: number;
  phone: string;
  otp_code: string;
  attempts: number;
  expires_at: string;
  is_verified: boolean;
  created_at: string;
}
