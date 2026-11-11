import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { db } from '../db/database-adapter';
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

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: { id: string; phone: string; role: UserRole }): string {
  return jwt.sign(
    {
      id: user.id,
      phone: user.phone,
      role: user.role
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
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string; phone: string; role: UserRole };

    const user = await db.findUserById(decoded.id);
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user account associated with this token no longer exists.'
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
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as { id: string; phone: string; role: UserRole };
      const user = await db.findUserById(decoded.id);
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
