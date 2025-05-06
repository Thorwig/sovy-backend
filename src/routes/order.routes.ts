import { Router } from 'express';
import { authenticate, authorizeMerchant } from '../middlewares/auth.middleware';
import { 
  createOrder, 
  getUserOrders, 
  getMerchantOrders, 
  updateOrderStatus,
  getOrderById,
  autoCancelOrder,
  cancelOrder,
  updatePaymentStatus
} from '../controllers/order.controller';

const router = Router();

router.post('/', authenticate, createOrder);
router.get('/user', authenticate, getUserOrders);
router.get('/merchant', authenticate, authorizeMerchant, getMerchantOrders);
router.get('/:id', authenticate, getOrderById);
router.patch('/:id/status', authenticate, authorizeMerchant, updateOrderStatus);
router.patch('/:id/auto-cancel', authenticate, autoCancelOrder);
router.post('/:id/cancel', authenticate, cancelOrder);
router.patch('/:id/payment', authenticate, authorizeMerchant, updatePaymentStatus);

export default router;