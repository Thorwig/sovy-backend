import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getMerchantProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const merchant = await prisma.merchant.findUnique({
      where: { userId },
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
        updatedAt: true,
        foodItems: {
          where: {
            expiryDate: { gt: new Date() },
            quantity: { gt: 0 }
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    return res.json(merchant);
  } catch (error) {
    console.error('Get merchant profile error:', error);
    return res.status(500).json({ message: 'Error fetching merchant profile' });
  }
};

export const updateMerchantProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { 
      businessName, 
      address,
      city,
      postalCode,
      phone, 
      latitude, 
      longitude 
    } = req.body;

    // Validate required fields
    if (!businessName || !address || !city || !postalCode || !phone || 
        latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        message: 'Business name, address, city, postal code, phone, latitude, and longitude are required' 
      });
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180' 
      });
    }

    const merchant = await prisma.merchant.findUnique({
      where: { userId }
    });

    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const updatedMerchant = await prisma.merchant.update({
      where: { userId },
      data: {
        businessName,
        address,
        city,
        postalCode,
        phone,
        latitude,
        longitude
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

    return res.json(updatedMerchant);
  } catch (error) {
    console.error('Update merchant profile error:', error);
    return res.status(500).json({ message: 'Error updating merchant profile' });
  }
};

export const getMerchantStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const merchant = await prisma.merchant.findUnique({
      where: { userId }
    });

    if (!merchant) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const merchantId = merchant.id;
    
    const stats = await prisma.$transaction(async (tx) => {
      // Get total orders
      const totalOrders = await tx.order.count({
        where: {
          items: {
            some: {
              foodItem: {
                merchantId,
              },
            },
          },
        },
      });

      // Calculate revenue from completed orders
      const revenue = await tx.orderItem.aggregate({
        where: {
          foodItem: {
            merchantId,
          },
          order: {
            status: 'PICKED_UP',
          },
        },
        _sum: {
          price: true,
          quantity: true,
        },
      });

      // Get total items saved from waste
      const itemsSaved = await tx.orderItem.aggregate({
        where: {
          foodItem: {
            merchantId,
          },
          order: {
            status: 'PICKED_UP',
          },
        },
        _sum: {
          quantity: true,
        },
      });

      // Get total active food items
      const totalFoodItems = await tx.foodItem.count({
        where: {
          merchantId,
          expiryDate: { gt: new Date() },
          quantity: { gt: 0 },
        },
      });

      // Get total sales (completed orders)
      const totalSales = await tx.order.count({
        where: {
          status: 'PICKED_UP',
          items: {
            some: {
              foodItem: {
                merchantId,
              },
            },
          },
        },
      });

      return {
        totalOrders,
        revenue: revenue._sum.price || 0,
        itemsSaved: itemsSaved._sum.quantity || 0,
        totalFoodItems,
        totalSales,
      };
    });

    return res.json(stats);
  } catch (error) {
    console.error('Error fetching merchant stats:', error);
    return res.status(500).json({ message: 'Error fetching merchant statistics' });
  }
};