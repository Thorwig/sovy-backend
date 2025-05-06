import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import { config } from '../config/config';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
  role: Role;
  merchantId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token missing' });
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

      // Verify user exists
      const user = await prisma.user.findUnique({ 
        where: { id: decoded.userId },
        select: { id: true, role: true }
      });

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Verify role matches
      if (user.role !== decoded.role) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      // If merchant role, verify merchantId exists in token and is valid
      if (user.role === Role.MERCHANT) {
        if (!decoded.merchantId) {
          return res.status(401).json({ message: 'Invalid merchant token' });
        }

        const merchant = await prisma.merchant.findFirst({
          where: {
            id: decoded.merchantId,
            userId: decoded.userId
          }
        });

        if (!merchant) {
          return res.status(401).json({ message: 'Invalid merchant token' });
        }
      }

      req.user = decoded;
      return next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'Token has expired' });
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

export const authorizeMerchant = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (req.user?.role !== Role.MERCHANT || !req.user?.merchantId) {
    return res.status(403).json({ message: 'Merchant access required' });
  }
  return next();
};

export const authorizeClient = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (req.user?.role !== Role.CLIENT) {
    return res.status(403).json({ message: 'Client access required' });
  }
  return next();
};