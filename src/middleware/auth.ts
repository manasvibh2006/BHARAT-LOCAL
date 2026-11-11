import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { db } from '../db/database-adapter';
import { memoryDb } from '../db/memory-db';
import { UserRole } from '../config/constants';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  name: string;
  preferred_language: string;
  city: string;
  state: string;
  locality?: string;
  pincode: string;
}

export interface JwtClaims {
  id: string;
  phone: string;
  role: UserRole;
  name?: string;
  preferred_language?: string;
  city?: string;
  state?: string;
  locality?: string;
  pincode?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: { id: string; phone: string; role: UserRole; [key: string]: any }): string {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      preferred_language: user.preferred_language,
      city: user.city,
      state: user.state,
      locality: user.locality,
      pincode: user.pincode
    },
    ENV.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is missing. Please provide a Bearer token.'
        }
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtClaims;

    let user = await db.findUserById(decoded.id);

    // Serverless cold-start resilience (Vercel):
    // In serverless environments, container instances scale dynamically.
    // If user account is not in this instance's memory, re-hydrate from cryptographically verified JWT claims!
    if (!user && decoded.phone) {
      user = {
        id: decoded.id,
        phone: decoded.phone,
        name: decoded.name || `Resident ${decoded.phone.slice(-4)}`,
        role: decoded.role || 'user',
        preferred_language: decoded.preferred_language || 'hi',
        state: decoded.state || 'India',
        city: decoded.city || 'Pune',
        locality: decoded.locality || '',
        pincode: decoded.pincode || '411038',
        is_banned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryDb.users.set(user.id, user);
      if (typeof (memoryDb as any).persist === 'function') {
        (memoryDb as any).persist();
      }
    }

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user account associated with this token no longer exists. Please log in again.'
        }
      });
      return;
    }

    if (user.is_banned) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BANNED',
          message: 'Your account has been suspended due to community guidelines violation.'
        }
      });
      return;
    }

    req.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      preferred_language: user.preferred_language,
      city: user.city,
      state: user.state,
      locality: user.locality,
      pincode: user.pincode
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token. Please log in again.'
      }
    });
  }
}

// Optional Auth (for public feed requests that want to personalize if token is passed)
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtClaims;
      let user = await db.findUserById(decoded.id);

      if (!user && decoded.phone) {
        user = {
          id: decoded.id,
          phone: decoded.phone,
          name: decoded.name || `Resident ${decoded.phone.slice(-4)}`,
          role: decoded.role || 'user',
          preferred_language: decoded.preferred_language || 'hi',
          state: decoded.state || 'India',
          city: decoded.city || 'Pune',
          locality: decoded.locality || '',
          pincode: decoded.pincode || '411038',
          is_banned: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        memoryDb.users.set(user.id, user);
      }

      if (user && !user.is_banned) {
        req.user = {
          id: user.id,
          phone: user.phone,
          role: user.role,
          name: user.name,
          preferred_language: user.preferred_language,
          city: user.city,
          state: user.state,
          locality: user.locality,
          pincode: user.pincode
        };
      }
    }
  } catch (e) {
    // Ignore and proceed as guest
  }
  next();
}
