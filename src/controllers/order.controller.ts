import { Request, Response } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { getWebSocketService } from '../services/websocket.service';

const prisma = new PrismaClient();

// Define PaymentStatus manually since it's new
type PaymentStatus = 'PENDING' | 'PAID';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  foodItem: {
    id: string;
    name: string;
    merchant: {
      id: string;
      businessName: string;
      address: string;
      latitude: number;
      longitude: number;
    };
  };
}

interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  items: OrderItem[];
  pickupTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_PAGE_SIZE = 10;

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, pickupTime } = req.body;
    const userId = req.user!.userId;

    // Validate input
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

    // Start a transaction
    const order = await prisma.$transaction(async (tx) => {
      let total = 0;
      const orderItems = [];

      // Validate and process each item
      for (const item of items) {
        const foodItem = await tx.foodItem.findUnique({
          where: { 
            id: item.foodItemId,
            expiryDate: { gt: new Date() }
          },
          include: {
            merchant: true
          }
        });

        if (!foodItem) {
          throw new Error(`Food item ${item.foodItemId} not found or expired`);
        }

        if (foodItem.quantity < item.quantity) {
          throw new Error(`Insufficient quantity for ${foodItem.name}`);
        }

        // Update stock
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

      // Create order with items
      const createdOrder = await tx.order.create({
        data: {
          userId,
          total,
          pickupTime: new Date(pickupTime),
          status: OrderStatus.PENDING,
          items: {
            create: orderItems
          }
        },
        include: {
          items: {
            include: {
              foodItem: {
                include: {
                  merchant: {
                    select: {
                      businessName: true,
                      address: true,
                      latitude: true,
                      longitude: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Get merchant details from first item
      const merchant = createdOrder.items[0].foodItem.merchant;

      return {
        order: {
          ...createdOrder,
          items: createdOrder.items.map(item => ({
            ...item,
            item: item.foodItem
          }))
        },
        merchant: {
          name: merchant.businessName,
          address: merchant.address,
          coordinates: {
            latitude: merchant.latitude,
            longitude: merchant.longitude
          }
        }
      };
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Error creating order' });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { status, page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Get total count for pagination
    const totalOrders = await prisma.order.count({
      where: { 
        userId,
        ...(status && { status: status as OrderStatus })
      }
    });

    const orders = await prisma.order.findMany({
      where: { 
        userId,
        ...(status && { status: status as OrderStatus })
      },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    // Format orders to match frontend expectations
    const formattedOrders = orders.map(order => {
      // Get merchant details from first item
      const merchant = order.items[0]?.foodItem?.merchant;
      
      return {
        ...order,
        merchant: merchant ? {
          businessName: merchant.businessName,
          address: merchant.address,
          coordinates: {
            latitude: merchant.latitude,
            longitude: merchant.longitude
          }
        } : null,
        items: order.items.map(item => ({
          ...item,
          foodItem: item.foodItem
        }))
      };
    });

    return res.json({
      orders: formattedOrders,
      total: totalOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalOrders / Number(limit))
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    return res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.order.findFirst({
      where: { 
        id,
        userId
      },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get merchant details from first item
    const merchant = order.items[0].foodItem.merchant;

    return res.json({
      order: {
        ...order,
        items: order.items.map(item => ({
          ...item,
          item: item.foodItem
        }))
      },
      merchant: {
        name: merchant.businessName,
        address: merchant.address,
        coordinates: {
          latitude: merchant.latitude,
          longitude: merchant.longitude
        }
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    return res.status(500).json({ message: 'Error fetching order details' });
  }
};

export const getMerchantOrders = async (req: Request, res: Response) => {
  try {
    const merchantId = req.user!.merchantId;  // Changed from userId to merchantId
    const { status, page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Get total count for pagination
    const totalOrders = await prisma.order.count({
      where: {
        items: {
          some: {
            foodItem: {
              merchantId
            }
          }
        },
        ...(status && { status: status as OrderStatus })
      }
    });

    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            foodItem: {
              merchantId
            }
          }
        },
        ...(status && { status: status as OrderStatus })
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
            foodItem: {
              include: {
                merchant: {
                  select: {
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    });

    // Format orders to match frontend expectations
    const formattedOrders = orders.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        item: item.foodItem
      }))
    }));

    return res.json({
      orders: formattedOrders,
      total: totalOrders,
      currentPage: Number(page),
      totalPages: Math.ceil(totalOrders / Number(limit))
    });
  } catch (error) {
    console.error('Get merchant orders error:', error);
    return res.status(500).json({ message: 'Error fetching orders' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await prisma.order.findFirst({
      where: { id },
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

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow cancellation if order is pending
    if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.PENDING) {
      return res.status(400).json({ 
        message: 'Only pending orders can be cancelled' 
      });
    }

    if (!isValidStatusTransition(order.status, status as OrderStatus)) {
      return res.status(400).json({ 
        message: 'Invalid status transition' 
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: status as OrderStatus },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // If order is cancelled, restore food item quantities
    if (status === OrderStatus.CANCELLED) {
      await Promise.all(
        updatedOrder.items.map(item =>
          prisma.foodItem.update({
            where: { id: item.foodItemId },
            data: {
              quantity: {
                increment: item.quantity
              }
            }
          })
        )
      );
    }

    // Get merchant details from first item
    const merchant = updatedOrder.items[0]?.foodItem?.merchant;
    
    // Format response data
    const responseData = {
      ...updatedOrder,
      items: updatedOrder.items.map(item => ({
        ...item,
        foodItem: item.foodItem
      }))
    };

    // Broadcast order update through WebSocket
    const wsService = getWebSocketService();
    wsService.broadcastOrderUpdate(
      order.userId,
      merchant?.id || null,
      responseData
    );

    return res.json(responseData);
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ message: 'Error updating order status' });
  }
};

// Helper function to validate order status transitions
function isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    [OrderStatus.PICKED_UP]: [], // Terminal state
    [OrderStatus.CANCELLED]: [], // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

export const autoCancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.order.findFirst({
      where: { 
        id,
        userId, // Ensure user owns this order
        status: OrderStatus.PENDING // Only pending orders can be auto-cancelled
      },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled' });
    }

    // Verify pickup time has passed
    const pickupTime = new Date(order.pickupTime);
    const now = new Date();
    if (pickupTime > now) {
      return res.status(400).json({ message: 'Order pickup time has not passed yet' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Restore food item quantities
    await Promise.all(
      updatedOrder.items.map(item =>
        prisma.foodItem.update({
          where: { id: item.foodItemId },
          data: {
            quantity: {
              increment: item.quantity
            }
          }
        })
      )
    );

    // Get merchant details from first item
    const merchant = updatedOrder.items[0]?.foodItem?.merchant;
    
    // Format response data
    const responseData = {
      ...updatedOrder,
      items: updatedOrder.items.map(item => ({
        ...item,
        foodItem: item.foodItem
      }))
    };

    // Broadcast order update through WebSocket
    const wsService = getWebSocketService();
    wsService.broadcastOrderUpdate(
      order.userId,
      merchant?.id || null,
      responseData
    );

    return res.json(responseData);
  } catch (error) {
    console.error('Auto-cancel order error:', error);
    return res.status(500).json({ message: 'Error auto-cancelling order' });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.order.findFirst({
      where: { 
        id,
        userId, // Ensure user owns this order
        status: OrderStatus.PENDING // Only pending orders can be cancelled
      },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or cannot be cancelled' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Restore food item quantities
    await Promise.all(
      updatedOrder.items.map(item =>
        prisma.foodItem.update({
          where: { id: item.foodItemId },
          data: {
            quantity: {
              increment: item.quantity
            }
          }
        })
      )
    );

    // Get merchant details from first item
    const merchant = updatedOrder.items[0]?.foodItem?.merchant;
    
    // Format response data
    const responseData = {
      order: {
        ...updatedOrder,
        items: updatedOrder.items.map(item => ({
          ...item,
          foodItem: item.foodItem
        }))
      },
      merchant: {
        name: merchant.businessName,
        address: merchant.address,
        coordinates: {
          latitude: merchant.latitude,
          longitude: merchant.longitude
        }
      }
    };

    // Broadcast order update through WebSocket
    const wsService = getWebSocketService();
    wsService.broadcastOrderUpdate(
      order.userId,
      merchant.id,
      responseData
    );

    return res.json(responseData);
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ message: 'Error cancelling order' });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: PaymentStatus };

    // Verify merchant owns this order
    const merchantId = req.user!.merchantId;
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
      },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    }) as Order | null;

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        // @ts-ignore - PaymentStatus is valid but TypeScript doesn't know about it yet
        paymentStatus: status
      },
      include: {
        items: {
          include: {
            foodItem: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    businessName: true,
                    address: true,
                    latitude: true,
                    longitude: true
                  }
                }
              }
            }
          }
        }
      }
    }) as Order;

    // Get merchant details from first item
    const merchant = updatedOrder.items[0]?.foodItem?.merchant;
    
    // Format response data
    const responseData = {
      ...updatedOrder,
      items: updatedOrder.items.map((item: OrderItem) => ({
        ...item,
        foodItem: item.foodItem
      }))
    };

    // Broadcast order update through WebSocket
    const wsService = getWebSocketService();
    wsService.broadcastOrderUpdate(
      order.userId,
      merchant?.id || null,
      responseData
    );

    return res.json(responseData);
  } catch (error) {
    console.error('Update payment status error:', error);
    return res.status(500).json({ message: 'Error updating payment status' });
  }
};