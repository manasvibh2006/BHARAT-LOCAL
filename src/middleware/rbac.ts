import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserRole, USER_ROLES } from '../config/constants';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required for this operation.'
        }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
        }
      });
      return;
    }

    next();
  };
}

export const requireModeratorOrAdmin = requireRole(USER_ROLES.MODERATOR, USER_ROLES.ADMIN);
export const requireAdmin = requireRole(USER_ROLES.ADMIN);
