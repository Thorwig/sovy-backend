"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMerchantStats = exports.updateMerchantProfile = exports.getMerchantProfile = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getMerchantProfile = async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const merchant = await prisma.merchant.findUnique({
            where: { id: merchantId },
            include: {
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
        const { password, ...merchantData } = merchant;
        return res.json(merchantData);
    }
    catch (error) {
        console.error('Get merchant profile error:', error);
        return res.status(500).json({ message: 'Error fetching merchant profile' });
    }
};
exports.getMerchantProfile = getMerchantProfile;
const updateMerchantProfile = async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { name, businessName, address, latitude, longitude, email } = req.body;
        if (!name || !businessName || !address || latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                message: 'Name, business name, address, latitude, and longitude are required'
            });
        }
        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                message: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180'
            });
        }
        if (email) {
            if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return res.status(400).json({ message: 'Invalid email format' });
            }
            const existingMerchant = await prisma.merchant.findFirst({
                where: {
                    email,
                    id: { not: merchantId }
                }
            });
            if (existingMerchant) {
                return res.status(400).json({ message: 'Email is already in use' });
            }
        }
        const updatedMerchant = await prisma.merchant.update({
            where: { id: merchantId },
            data: {
                name,
                businessName,
                address,
                latitude,
                longitude,
                ...(email && { email })
            },
        });
        const { password, ...merchantData } = updatedMerchant;
        return res.json(merchantData);
    }
    catch (error) {
        console.error('Update merchant profile error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email is already in use' });
        }
        return res.status(500).json({ message: 'Error updating merchant profile' });
    }
};
exports.updateMerchantProfile = updateMerchantProfile;
const getMerchantStats = async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const stats = await prisma.$transaction(async (tx) => {
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
            const itemsSaved = await tx.foodItem.aggregate({
                where: {
                    merchantId,
                    orders: {
                        some: {
                            order: {
                                status: 'PICKED_UP',
                            },
                        },
                    },
                },
                _sum: {
                    quantity: true,
                },
            });
            const popularItems = await tx.foodItem.findMany({
                where: {
                    merchantId,
                    orders: {
                        some: {
                            order: {
                                status: 'PICKED_UP',
                            },
                        },
                    },
                },
                orderBy: {
                    orders: {
                        _count: 'desc',
                    },
                },
                take: 5,
            });
            return {
                totalOrders,
                revenue: revenue._sum.price || 0,
                itemsSaved: itemsSaved._sum.quantity || 0,
                popularItems,
            };
        });
        return res.json(stats);
    }
    catch (error) {
        console.error('Get merchant stats error:', error);
        return res.status(500).json({ message: 'Error fetching merchant statistics' });
    }
};
exports.getMerchantStats = getMerchantStats;
//# sourceMappingURL=merchant.controller.js.map