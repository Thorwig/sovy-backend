import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createFoodItem = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const price = parseFloat(req.body.price);
    const originalPrice = parseFloat(req.body.originalPrice);
    const quantity = parseInt(req.body.quantity, 10);
    const { expiryDate } = req.body;
    const merchantId = req.user!.merchantId; // Changed from userId to merchantId

    // Validate required fields
    if (!name || isNaN(price) || isNaN(originalPrice) || isNaN(quantity) || !expiryDate || !merchantId) {
      return res.status(400).json({ 
        message: 'Missing required fields. Name, price, originalPrice, quantity, expiryDate, and merchantId are required.' 
      });
    }

    // Validate price and quantity
    if (price <= 0 || originalPrice <= 0 || quantity < 0) {
      return res.status(400).json({ 
        message: 'Price and originalPrice must be greater than 0, quantity must be non-negative' 
      });
    }

    // Validate expiry date
    const parsedExpiryDate = new Date(expiryDate);
    if (isNaN(parsedExpiryDate.getTime()) || parsedExpiryDate <= new Date()) {
      return res.status(400).json({ 
        message: 'Invalid expiry date. Date must be in the future.' 
      });
    }

    const foodItem = await prisma.foodItem.create({
      data: {
        name,
        description: description || '',
        price,
        originalPrice,
        quantity,
        expiryDate: parsedExpiryDate,
        merchantId: merchantId!,
        imageUrl: req.file?.path || undefined,
      },
      include: {
        merchant: true // Include merchant details in response
      }
    });

    return res.status(201).json(foodItem);
  } catch (error) {
    console.error('Create food item error:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Invalid merchant ID' });
    }
    return res.status(500).json({ message: 'Error creating food item' });
  }
};

export const getNearbyFoodItems = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    const rad = Number(radius);

    // Get all food items with active merchants and calculate distance
    const foodItems = await prisma.foodItem.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() }
      },
      include: {
        merchant: true
      }
    });

    // Calculate distances and filter
    const nearbyItems = foodItems
      .map(item => {
        const distance = calculateDistance(
          lat,
          lng,
          item.merchant.latitude,
          item.merchant.longitude
        );
        return { ...item, distance };
      })
      .filter(item => item.distance <= rad)
      .sort((a, b) => a.distance - b.distance);

    return res.json(nearbyItems);
  } catch (error) {
    console.error('Get nearby food items error:', error);
    return res.status(500).json({ message: 'Error fetching nearby food items' });
  }
};

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

export const getFavoriteFoodItems = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const favorites = await prisma.foodItem.findMany({
      where: {
        favoritedBy: {
          some: {
            id: userId
          }
        },
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() }
      },
      include: {
        merchant: true
      }
    });

    return res.json(favorites);
  } catch (error) {
    console.error('Get favorite food items error:', error);
    return res.status(500).json({ message: 'Error fetching favorite food items' });
  }
};

export const getFoodItems = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    const foodItems = await prisma.foodItem.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { gt: new Date() },
        name: search ? { contains: search as string, mode: 'insensitive' } : undefined,
      },
      include: {
        merchant: true,
      },
    });

    return res.json(foodItems);
  } catch (error) {
    console.error('Get food items error:', error);
    return res.status(500).json({ message: 'Error fetching food items' });
  }
};

export const getFoodItemById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const foodItem = await prisma.foodItem.findUnique({
      where: {
        id,
      },
      include: {
        merchant: true,
      },
    });

    if (!foodItem) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    return res.json(foodItem);
  } catch (error) {
    console.error('Get food item by id error:', error);
    return res.status(500).json({ message: 'Error fetching food item' });
  }
};

export const updateFoodItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const price = parseFloat(req.body.price);
    const originalPrice = parseFloat(req.body.originalPrice);
    const quantity = parseInt(req.body.quantity, 10);
    const { expiryDate } = req.body;
    const merchantId = req.user!.merchantId; // Changed from userId to merchantId

    // Validate required fields
    if (!name || isNaN(price) || isNaN(originalPrice) || isNaN(quantity) || !expiryDate) {
      return res.status(400).json({ 
        message: 'Missing required fields. Name, price, originalPrice, quantity, and expiryDate are required.' 
      });
    }

    // Validate price and quantity
    if (price <= 0 || originalPrice <= 0 || quantity < 0) {
      return res.status(400).json({ 
        message: 'Price and originalPrice must be greater than 0, quantity must be non-negative' 
      });
    }

    const foodItem = await prisma.foodItem.update({
      where: {
        id,
        merchantId, // Using merchantId from token
      },
      data: {
        name,
        description,
        price,
        originalPrice,
        quantity,
        expiryDate: new Date(expiryDate),
        imageUrl: req.file?.path,
      },
    });

    return res.json(foodItem);
  } catch (error) {
    console.error('Update food item error:', error);
    return res.status(500).json({ message: 'Error updating food item' });
  }
};

export const deleteFoodItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const merchantId = req.user!.merchantId;

    // First check if the item exists and belongs to the merchant
    const foodItem = await prisma.foodItem.findUnique({
      where: {
        id,
      },
      include: {
        orders: true
      }
    });

    if (!foodItem) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    if (foodItem.merchantId !== merchantId) {
      return res.status(403).json({ message: 'You are not authorized to delete this food item' });
    }

    // Check if the item has any associated orders
    if (foodItem.orders && foodItem.orders.length > 0) {
      return res.status(400).json({ message: 'Cannot delete food item with existing orders' });
    }

    await prisma.foodItem.delete({
      where: {
        id,
        merchantId,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete food item error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Food item not found' });
    }
    return res.status(500).json({ message: 'Error deleting food item' });
  }
};

export const toggleFavorite = async (req: Request, res: Response) => {
  try {
    const { foodItemId } = req.params;
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { favorites: true },
    });

    const isFavorited = user?.favorites.some(item => item.id === foodItemId);

    if (isFavorited) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          favorites: {
            disconnect: { id: foodItemId },
          },
        },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          favorites: {
            connect: { id: foodItemId },
          },
        },
      });
    }

    return res.json({ isFavorited: !isFavorited });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return res.status(500).json({ message: 'Error toggling favorite status' });
  }
};