"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getMerchantOrders = exports.getUserOrders = exports.createOrder = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createOrder = async (req, res) => {
    try {
        const { items } = req.body;
        const userId = req.user.userId;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }
        for (const item of items) {
            if (!item.foodItemId || typeof item.quantity !== 'number' || item.quantity <= 0) {
                return res.status(400).json({
                    message: 'Each item must have a valid foodItemId and a positive quantity'
                });
            }
        }
        const order = await prisma.$transaction(async (tx) => {
            let total = 0;
            const orderItems = [];
            for (const item of items) {
                const foodItem = await tx.foodItem.findUnique({
                    where: {
                        id: item.foodItemId,
                        expiryDate: { gt: new Date() }
                    }
                });
                if (!foodItem) {
                    throw new Error(`Food item ${item.foodItemId} not found or expired`);
                }
                if (foodItem.quantity < item.quantity) {
                    throw new Error(`Insufficient quantity for ${foodItem.name}`);
                }
                await tx.foodItem.update({
                    where: { id: item.foodItemId },
                    data: { quantity: foodItem.quantity - item.quantity }
                });
                total += foodItem.price * item.quantity;
                orderItems.push({
                    foodItemId: item.foodItemId,
                    quantity: item.quantity,
                    price: foodItem.price
                });
            }
            return tx.order.create({
                data: {
                    userId,
                    total,
                    items: {
                        create: orderItems
                    }
                },
                include: {
                    items: {
                        include: {
                            foodItem: {
                                include: {
                                    merchant: true
                                }
                            }
                        }
                    }
                }
            });
        });
        return res.status(201).json(order);
    }
    catch (error) {
        console.error('Create order error:', error);
        if (error instanceof Error) {
            return res.status(400).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Error creating order' });
    }
};
exports.createOrder = createOrder;
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status } = req.query;
        const orders = await prisma.order.findMany({
            where: {
                userId,
                ...(status && { status: status })
            },
            include: {
                items: {
                    include: {
                        foodItem: {
                            include: {
                                merchant: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(orders);
    }
    catch (error) {
        console.error('Get user orders error:', error);
        return res.status(500).json({ message: 'Error fetching orders' });
    }
};
exports.getUserOrders = getUserOrders;
const getMerchantOrders = async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { status } = req.query;
        const orders = await prisma.order.findMany({
            where: {
                items: {
                    some: {
                        foodItem: {
                            merchantId
                        }
                    }
                },
                ...(status && { status: status })
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                items: {
                    include: {
                        foodItem: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(orders);
    }
    catch (error) {
        console.error('Get merchant orders error:', error);
        return res.status(500).json({ message: 'Error fetching orders' });
    }
};
exports.getMerchantOrders = getMerchantOrders;
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const merchantId = req.user.userId;
        if (!Object.values(client_1.OrderStatus).includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }
        const order = await prisma.order.findFirst({
            where: {
                id,
                items: {
                    some: {
                        foodItem: {
                            merchantId
                        }
                    }
                }
            }
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!isValidStatusTransition(order.status, status)) {
            return res.status(400).json({
                message: 'Invalid status transition'
            });
        }
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: { status: status },
            include: {
                items: {
                    include: {
                        foodItem: true
                    }
                }
            }
        });
        return res.json(updatedOrder);
    }
    catch (error) {
        console.error('Update order status error:', error);
        return res.status(500).json({ message: 'Error updating order status' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
function isValidStatusTransition(currentStatus, newStatus) {
    var _a, _b;
    const validTransitions = {
        [client_1.OrderStatus.PENDING]: [client_1.OrderStatus.CONFIRMED, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.CONFIRMED]: [client_1.OrderStatus.PICKED_UP, client_1.OrderStatus.CANCELLED],
        [client_1.OrderStatus.PICKED_UP]: [],
        [client_1.OrderStatus.CANCELLED]: [],
    };
    return (_b = (_a = validTransitions[currentStatus]) === null || _a === void 0 ? void 0 : _a.includes(newStatus)) !== null && _b !== void 0 ? _b : false;
}
//# sourceMappingURL=order.controller.js.map