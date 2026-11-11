export const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' }
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

export const POST_CATEGORIES = [
  { id: 'announcements', name_en: 'Announcements & Alerts', name_hi: 'घोषणाएँ और अलर्ट', icon: '📢' },
  { id: 'services', name_en: 'Local Services & Utilities', name_hi: 'स्थानीय सेवाएँ और सुविधाएँ', icon: '🛠️' },
  { id: 'help_wanted', name_en: 'Help Wanted & Jobs', name_hi: 'सहायता / रोज़गार', icon: '💼' },
  { id: 'buy_sell', name_en: 'Buy, Sell & Rent', name_hi: 'खरीद, बिक्री और किराया', icon: '🏷️' },
  { id: 'lost_found', name_en: 'Lost & Found', name_hi: 'खोया-पाया', icon: '🔍' },
  { id: 'events', name_en: 'Community Events & Gatherings', name_hi: 'सामुदायिक कार्यक्रम', icon: '🎪' },
  { id: 'emergency', name_en: 'Emergency & Urgent Aid', name_hi: 'आपातकालीन सहायता', icon: '🚨' }
] as const;

export type PostCategoryId = typeof POST_CATEGORIES[number]['id'];

export const USER_ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const POST_STATUS = {
  ACTIVE: 'active',
  PENDING_REVIEW: 'pending_review',
  FLAGGED: 'flagged',
  HIDDEN: 'hidden',
  REJECTED: 'rejected'
} as const;

export type PostStatus = typeof POST_STATUS[keyof typeof POST_STATUS];

export const REPORT_REASONS = [
  'spam',
  'hate_speech',
  'misinformation',
  'inappropriate',
  'fraud',
  'other'
] as const;

export type ReportReason = typeof REPORT_REASONS[number];

export const CACHE_KEYS = {
  feed: (city: string, locality?: string, category?: string, lang?: string, page = 1) =>
    `feed:${city.toLowerCase()}:${(locality || 'all').toLowerCase()}:${category || 'all'}:${lang || 'all'}:${page}`,
  post: (id: string) => `post:${id}`,
  stats: () => `community:stats`,
  otp: (phone: string) => `otp:${phone}`
};
