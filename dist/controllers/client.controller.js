"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientStats = exports.updateClientProfile = exports.getClientProfile = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getClientProfile = async (req, res) => {
    try {
        const clientId = req.user.userId;
        const client = await prisma.user.findUnique({
            where: { id: clientId },
            include: {
                favorites: {
                    include: {
                        merchant: true
                    }
                },
                orders: {
                    include: {
                        items: {
                            include: {
                                foodItem: {
                                    include: {
                                        merchant: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
            },
        });
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }
        const { password, ...clientData } = client;
        return res.json(clientData);
    }
    catch (error) {
        console.error('Get client profile error:', error);
        return res.status(500).json({ message: 'Error fetching client profile' });
    }
};
exports.getClientProfile = getClientProfile;
const updateClientProfile = async (req, res) => {
    try {
        const clientId = req.user.userId;
        const { name, email } = req.body;
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        const existingUser = await prisma.user.findFirst({
            where: {
                email,
                id: { not: clientId }
            }
        });
        if (existingUser) {
            return res.status(400).json({ message: 'Email is already in use' });
        }
        const updatedClient = await prisma.user.update({
            where: { id: clientId },
            data: { name, email },
        });
        const { password, ...clientData } = updatedClient;
        return res.json(clientData);
    }
    catch (error) {
        console.error('Update client profile error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email is already in use' });
        }
        return res.status(500).json({ message: 'Error updating client profile' });
    }
};
exports.updateClientProfile = updateClientProfile;
const getClientStats = async (req, res) => {
    try {
        const clientId = req.user.userId;
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
    }
    catch (error) {
        console.error('Get client stats error:', error);
        return res.status(500).json({ message: 'Error fetching client statistics' });
    }
};
exports.getClientStats = getClientStats;
//# sourceMappingURL=client.controller.js.map