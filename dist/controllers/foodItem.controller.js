"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleFavorite = exports.deleteFoodItem = exports.updateFoodItem = exports.getFoodItems = exports.getFavoriteFoodItems = exports.getNearbyFoodItems = exports.createFoodItem = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createFoodItem = async (req, res) => {
    var _a;
    try {
        const { name, description, price, originalPrice, quantity, expiryDate } = req.body;
        const merchantId = req.user.userId;
        if (!name || !price || !originalPrice || !quantity || !expiryDate) {
            return res.status(400).json({
                message: 'Missing required fields. Name, price, originalPrice, quantity, and expiryDate are required.'
            });
        }
        if (price <= 0 || originalPrice <= 0 || quantity < 0) {
            return res.status(400).json({
                message: 'Price and originalPrice must be greater than 0, quantity must be non-negative'
            });
        }
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
                merchantId,
                imageUrl: (_a = req.file) === null || _a === void 0 ? void 0 : _a.path,
            },
            include: {
                merchant: true
            }
        });
        return res.status(201).json(foodItem);
    }
    catch (error) {
        console.error('Create food item error:', error);
        if (error.code === 'P2003') {
            return res.status(400).json({ message: 'Invalid merchant ID' });
        }
        return res.status(500).json({ message: 'Error creating food item' });
    }
};
exports.createFoodItem = createFoodItem;
const getNearbyFoodItems = async (req, res) => {
    try {
        const { latitude, longitude, radius = 5000 } = req.query;
        if (!latitude || !longitude) {
            return res.status(400).json({ message: 'Latitude and longitude are required' });
        }
        const lat = Number(latitude);
        const lng = Number(longitude);
        const rad = Number(radius);
        const foodItems = await prisma.foodItem.findMany({
            where: {
                quantity: { gt: 0 },
                expiryDate: { gt: new Date() }
            },
            include: {
                merchant: true
            }
        });
        const nearbyItems = foodItems
            .map(item => {
            const distance = calculateDistance(lat, lng, item.merchant.latitude, item.merchant.longitude);
            return { ...item, distance };
        })
            .filter(item => item.distance <= rad)
            .sort((a, b) => a.distance - b.distance);
        return res.json(nearbyItems);
    }
    catch (error) {
        console.error('Get nearby food items error:', error);
        return res.status(500).json({ message: 'Error fetching nearby food items' });
    }
};
exports.getNearbyFoodItems = getNearbyFoodItems;
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
const getFavoriteFoodItems = async (req, res) => {
    try {
        const userId = req.user.userId;
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
    }
    catch (error) {
        console.error('Get favorite food items error:', error);
        return res.status(500).json({ message: 'Error fetching favorite food items' });
    }
};
exports.getFavoriteFoodItems = getFavoriteFoodItems;
const getFoodItems = async (req, res) => {
    try {
        const { search } = req.query;
        const foodItems = await prisma.foodItem.findMany({
            where: {
                quantity: { gt: 0 },
                expiryDate: { gt: new Date() },
                name: search ? { contains: search, mode: 'insensitive' } : undefined,
            },
            include: {
                merchant: true,
            },
        });
        return res.json(foodItems);
    }
    catch (error) {
        console.error('Get food items error:', error);
        return res.status(500).json({ message: 'Error fetching food items' });
    }
};
exports.getFoodItems = getFoodItems;
const updateFoodItem = async (req, res) => {
    var _a;
    try {
        const { id } = req.params;
        const { name, description, price, originalPrice, quantity, expiryDate } = req.body;
        const merchantId = req.user.userId;
        const foodItem = await prisma.foodItem.update({
            where: {
                id,
                merchantId,
            },
            data: {
                name,
                description,
                price,
                originalPrice,
                quantity,
                expiryDate: new Date(expiryDate),
                imageUrl: (_a = req.file) === null || _a === void 0 ? void 0 : _a.path,
            },
        });
        return res.json(foodItem);
    }
    catch (error) {
        console.error('Update food item error:', error);
        return res.status(500).json({ message: 'Error updating food item' });
    }
};
exports.updateFoodItem = updateFoodItem;
const deleteFoodItem = async (req, res) => {
    try {
        const { id } = req.params;
        const merchantId = req.user.userId;
        await prisma.foodItem.delete({
            where: {
                id,
                merchantId,
            },
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error('Delete food item error:', error);
        return res.status(500).json({ message: 'Error deleting food item' });
    }
};
exports.deleteFoodItem = deleteFoodItem;
const toggleFavorite = async (req, res) => {
    try {
        const { foodItemId } = req.params;
        const userId = req.user.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { favorites: true },
        });
        const isFavorited = user === null || user === void 0 ? void 0 : user.favorites.some(item => item.id === foodItemId);
        if (isFavorited) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    favorites: {
                        disconnect: { id: foodItemId },
                    },
                },
            });
        }
        else {
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
    }
    catch (error) {
        console.error('Toggle favorite error:', error);
        return res.status(500).json({ message: 'Error toggling favorite status' });
    }
};
exports.toggleFavorite = toggleFavorite;
//# sourceMappingURL=foodItem.controller.js.map