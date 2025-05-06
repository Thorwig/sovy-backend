import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getClientProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in token' });
    }

    const client = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        favorites: {
          select: {
            id: true,
            name: true,
            merchant: {
              select: {
                id: true,
                businessName: true,
                address: true,
              },
            },
          },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                foodItem: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    merchant: {
                      select: {
                        businessName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ message: 'Client profile not found' });
    }

    return res.json(client);
  } catch (error) {
    console.error('Error fetching client profile:', error);
    return res.status(500).json({ message: 'Error fetching client profile' });
  }
};

export const updateClientProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { name, email } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in token' });
    }

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email is already taken' });
      }
    }

    const updatedClient = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client profile:', error);
    return res.status(500).json({ message: 'Error updating client profile' });
  }
};

export const getClientStats = async (req: Request, res: Response) => {
  try {
    const clientId = req.user!.userId;
    const stats = await prisma.$transaction(async (tx) => {
      const totalOrders = await tx.order.count({
        where: { userId: clientId },
      });

      const totalSpent = await tx.order.aggregate({
        where: {
          userId: clientId,
          status: 'PICKED_UP',
        },
        _sum: {
          total: true,
        },
      });

      const itemsSaved = await tx.orderItem.aggregate({
        where: {
          order: {
            userId: clientId,
            status: 'PICKED_UP',
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const favoriteMerchants = await tx.merchant.findMany({
        where: {
          foodItems: {
            some: {
              favoritedBy: {
                some: {
                  id: clientId
                }
              }
            }
          }
        },
        take: 3
      });

      return {
        totalOrders,
        totalSpent: totalSpent._sum.total || 0,
        itemsSaved: itemsSaved._sum.quantity || 0,
        favoriteMerchants,
      };
    });

    return res.json(stats);
  } catch (error) {
    console.error('Get client stats error:', error);
    return res.status(500).json({ message: 'Error fetching client statistics' });
  }
};