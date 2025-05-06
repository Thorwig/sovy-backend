import cron from 'node-cron';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { getWebSocketService } from './websocket.service';

const prisma = new PrismaClient();

export class OrderCleanupService {
  private cronJob: cron.ScheduledTask;

  constructor() {
    // Run every minute
    this.cronJob = cron.schedule('*/1 * * * *', this.cleanupExpiredOrders);
  }

  private cleanupExpiredOrders = async () => {
    try {
      // Find all pending orders where pickup time has passed
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          pickupTime: {
            lt: new Date()
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
      });

      for (const order of expiredOrders) {
        // Update order status to cancelled
        const updatedOrder = await prisma.order.update({
          where: { id: order.id },
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

        // Notify via WebSocket
        const wsService = getWebSocketService();
        wsService.broadcastOrderUpdate(
          order.userId,
          merchant?.id || null,
          responseData
        );
      }
    } catch (error) {
      console.error('Error in cleanupExpiredOrders:', error);
    }
  };

  start() {
    this.cronJob.start();
  }

  stop() {
    this.cronJob.stop();
  }
}