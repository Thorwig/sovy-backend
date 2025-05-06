import { Router } from 'express';
import { authenticate, authorizeMerchant } from '../middlewares/auth.middleware';
import { getMerchantProfile, updateMerchantProfile, getMerchantStats } from '../controllers/merchant.controller';

const router = Router();

router.get('/profile', authenticate, authorizeMerchant, getMerchantProfile);
router.put('/profile', authenticate, authorizeMerchant, updateMerchantProfile);
router.get('/stats', authenticate, authorizeMerchant, getMerchantStats);

export default router;