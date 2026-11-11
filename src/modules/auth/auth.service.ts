import { db } from '../../db/database-adapter';
import { cacheService } from '../../cache/cache-service';
import { generateToken } from '../../middleware/auth';
import { ENV } from '../../config/env';
import { User } from '../../db/schema';

export class AuthService {
  // Normalize phone to E.164 (+91XXXXXXXXXX)
  public static normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    return phone.startsWith('+') ? phone : `+${digits}`;
  }

  public static async requestOtp(rawPhone: string): Promise<{
    message: string;
    phone: string;
    expiresInSeconds: number;
    devOtp?: string;
  }> {
    const phone = this.normalizePhone(rawPhone);
    const otpCode = ENV.NODE_ENV === 'production' 
      ? Math.floor(100000 + Math.random() * 900000).toString() 
      : ENV.OTP_DEV_MOCK_CODE;

    const cacheKey = `otp:${phone}`;
    const ttlSeconds = ENV.OTP_EXPIRY_MINUTES * 60;

    await cacheService.set(cacheKey, { otpCode, attempts: 0 }, ttlSeconds);

    console.log(`[AUTH] 📲 Sent OTP for ${phone}: [${otpCode}] (Valid for ${ENV.OTP_EXPIRY_MINUTES} mins)`);

    return {
      message: `OTP sent successfully to ${phone}.`,
      phone,
      expiresInSeconds: ttlSeconds,
      ...(ENV.NODE_ENV !== 'production' ? { devOtp: otpCode } : {})
    };
  }

  public static async verifyOtp(data: {
    phone: string;
    otp: string;
    name?: string;
    preferred_language?: string;
    state?: string;
    city?: string;
    locality?: string;
    pincode?: string;
  }): Promise<{ token: string; user: User; isNewUser: boolean }> {
    const phone = this.normalizePhone(data.phone);
    const cacheKey = `otp:${phone}`;

    // Validate OTP
    const cached = await cacheService.get<{ otpCode: string; attempts: number }>(cacheKey);

    const isDevBypass = data.otp === ENV.OTP_DEV_MOCK_CODE;
    const isValidOtp = cached && cached.otpCode === data.otp;

    if (!isDevBypass && !isValidOtp) {
      if (cached) {
        cached.attempts += 1;
        await cacheService.set(cacheKey, cached, 300);
      }
      throw new Error('Invalid or expired OTP. Please request a new code.');
    }

    // Clear OTP after successful use
    await cacheService.del(cacheKey);

    let user = await db.findUserByPhone(phone);
    let isNewUser = false;

    if (!user) {
      // Create new user profile with defaults
      isNewUser = true;
      user = await db.createUser({
        phone,
        name: data.name || `Resident ${phone.slice(-4)}`,
        role: 'user',
        preferred_language: data.preferred_language || 'hi',
        state: data.state || 'Karnataka',
        city: data.city || 'Bengaluru',
        locality: data.locality || 'Indiranagar',
        pincode: data.pincode || '560038'
      });
    } else {
      // If user provided profile updates on login, update them
      if (data.name || data.preferred_language || data.city || data.state || data.pincode) {
        user = await db.updateUser(user.id, {
          ...(data.name ? { name: data.name } : {}),
          ...(data.preferred_language ? { preferred_language: data.preferred_language } : {}),
          ...(data.city ? { city: data.city } : {}),
          ...(data.state ? { state: data.state } : {}),
          ...(data.locality ? { locality: data.locality } : {}),
          ...(data.pincode ? { pincode: data.pincode } : {})
        }) || user;
      }
    }

    const token = generateToken(user);
    return { token, user, isNewUser };
  }

  public static async getDemoPersonas() {
    const admin = await db.findUserByPhone('+919999999999');
    const moderator = await db.findUserByPhone('+918888888888');
    const bengaluruCitizen = await db.findUserByPhone('+919876543210');
    const jaipurCitizen = await db.findUserByPhone('+919812345678');

    return [
      {
        role: 'admin',
        title: 'District Administrator',
        phone: '+919999999999',
        name: admin?.name || 'Dr. Ramesh Sharma',
        location: `${admin?.city || 'Jaipur'}, ${admin?.state || 'Rajasthan'}`,
        preferred_language: admin?.preferred_language || 'hi',
        token: admin ? generateToken(admin) : null,
        capabilities: ['Full system access', 'Broadcast alerts', 'Manage categories', 'Ban users']
      },
      {
        role: 'moderator',
        title: 'Community Moderator',
        phone: '+918888888888',
        name: moderator?.name || 'Priya Sundaram',
        location: `${moderator?.city || 'Chennai'}, ${moderator?.state || 'Tamil Nadu'}`,
        preferred_language: moderator?.preferred_language || 'ta',
        token: moderator ? generateToken(moderator) : null,
        capabilities: ['Review reported posts queue', 'Approve/Reject posts', 'Restore hidden posts']
      },
      {
        role: 'user',
        title: 'Local Citizen (Bengaluru)',
        phone: '+919876543210',
        name: bengaluruCitizen?.name || 'Anand Kumar',
        location: `${bengaluruCitizen?.city || 'Bengaluru'}, ${bengaluruCitizen?.state || 'Karnataka'}`,
        preferred_language: bengaluruCitizen?.preferred_language || 'kn',
        token: bengaluruCitizen ? generateToken(bengaluruCitizen) : null,
        capabilities: ['Browse local feed', 'Post announcements/services', 'Report inappropriate posts']
      },
      {
        role: 'user',
        title: 'Local Citizen (Jaipur)',
        phone: '+919812345678',
        name: jaipurCitizen?.name || 'Sunita Meena',
        location: `${jaipurCitizen?.city || 'Jaipur'}, ${jaipurCitizen?.state || 'Rajasthan'}`,
        preferred_language: jaipurCitizen?.preferred_language || 'hi',
        token: jaipurCitizen ? generateToken(jaipurCitizen) : null,
        capabilities: ['Browse local feed', 'Post announcements/services', 'Report inappropriate posts']
      }
    ];
  }
}
