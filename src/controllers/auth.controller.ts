import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { geocodeAddress } from '../services/geocoding.service';
import { config } from '../config/config';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response) => {
  try {
    const { 
      email, 
      password, 
      name, 
      role, 
      businessName, 
      description,
      phone,
      address,
      city,
      postalCode,
      imageUrl,
      latitude,
      longitude
    } = req.body;

    // Basic validation for all registrations
    if (!email || !password || !name || !role) {
      return res.status(400).json({ 
        message: 'Email, password, name, and role are required' 
      });
    }

    // Validate email format
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check for existing accounts
    try {
      const existingUser = await prisma.user.findUnique({ 
        where: { email }
      });
      
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
    } catch (error) {
      console.error('Error checking existing accounts:', error);
      return res.status(500).json({ message: 'Error checking account availability' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === Role.MERCHANT) {
      // Additional validation for merchant registration
      if (!businessName || !address || !city || !postalCode || !phone) {
        return res.status(400).json({ 
          message: 'Business name, address, city, postal code, and phone are required for merchant registration' 
        });
      }

      try {
        let lat = latitude;
        let lon = longitude;

        // If coordinates not provided, geocode the address
        if (lat === undefined || lon === undefined) {
          const geoResult = await geocodeAddress(address, city, postalCode);
          lat = geoResult.lat;
          lon = geoResult.lon;
        } else {
          // Validate provided coordinates
          if (typeof lat !== 'number' || typeof lon !== 'number' ||
              lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return res.status(400).json({ 
              message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180' 
            });
          }
        }

        // Create user with merchant in a transaction
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              password: hashedPassword,
              name,
              role: Role.MERCHANT
            }
          });

          const merchant = await tx.merchant.create({
            data: {
              userId: user.id,
              businessName,
              address,
              city,
              postalCode,
              phone,
              latitude: lat,
              longitude: lon,
              ...(description && { description }),
              ...(imageUrl && { imageUrl })
            },
            select: {
              id: true,
              userId: true,
              businessName: true,
              address: true,
              city: true,
              postalCode: true,
              phone: true,
              latitude: true,
              longitude: true,
              createdAt: true,
              updatedAt: true
            }
          });

          const { password: _, ...userWithoutPassword } = user;
          return { user: userWithoutPassword, merchant };
        });

        const token = jwt.sign(
          { 
            userId: result.user.id,
            role: Role.MERCHANT,
            merchantId: result.merchant.id
          },
          config.jwtSecret,
          { expiresIn: '7d' }
        );

        return res.status(201).json({
          token,
          user: result.user,
          merchant: result.merchant
        });

      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Address not found')) {
            return res.status(400).json({ 
              message: 'Could not verify address. Please check your address information and try again.',
              field: 'address'
            });
          }
          if (error.message.includes('outside of Morocco')) {
            return res.status(400).json({ 
              message: 'The provided address must be within Morocco.' 
            });
          }
          if (error.message.includes('Geocoding service failed')) {
            return res.status(503).json({ 
              message: 'Address verification service is temporarily unavailable. Please try again later.' 
            });
          }
          return res.status(400).json({ 
            message: error.message
          });
        }
        throw error;
      }
    } else if (role === Role.CLIENT) {
      // Create regular user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: Role.CLIENT
        }
      });

      const token = jwt.sign(
        { userId: user.id, role: Role.CLIENT },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      const { password: _, ...userWithoutPassword } = user;

      return res.status(201).json({ 
        token,
        user: userWithoutPassword
      });
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      message: 'Server error during registration. Please try again later.' 
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'Email, password, and role are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || user.role !== role) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    let merchantData = null;
    // Define a flexible type for tokenPayload that can include merchantId
    let tokenPayload: { userId: string; role: Role; merchantId?: string } = { userId: user.id, role: user.role };

    if (role === Role.MERCHANT) {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          businessName: true,
          address: true,
          city: true,
          postalCode: true,
          phone: true,
          latitude: true,
          longitude: true
        }
      });

      if (!merchant) {
        return res.status(401).json({ message: 'Merchant profile not found' });
      }

      merchantData = merchant;
      tokenPayload = { ...tokenPayload, merchantId: merchant.id };
    }

    const token = jwt.sign(
      tokenPayload,
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Remove sensitive data before sending response
    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      token,
      user: userWithoutPassword,
      ...(merchantData && { merchant: merchantData })
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};