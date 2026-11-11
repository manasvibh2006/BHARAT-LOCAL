import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../db/database-adapter';

export class AuthController {
  public static async requestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.requestOtp(req.body.phone);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.verifyOtp(req.body);
      res.status(200).json({
        success: true,
        message: result.isNewUser ? 'User profile registered and verified.' : 'Logged in successfully.',
        data: result
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OTP_VERIFICATION_FAILED',
          message: err.message
        }
      });
    }
  }

  public static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await db.findUserById(req.user!.id);
      if (!user) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        return;
      }
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await db.updateUser(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Profile preferences updated successfully.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getDemoPersonas(req: Request, res: Response, next: NextFunction) {
    try {
      const personas = await AuthService.getDemoPersonas();
      res.status(200).json({
        success: true,
        data: personas
      });
    } catch (err) {
      next(err);
    }
  }
}
