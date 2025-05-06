import { Router } from 'express';
import { authenticate, authorizeClient } from '../middlewares/auth.middleware';
import { getClientProfile, updateClientProfile, getClientStats } from '../controllers/client.controller';

const router = Router();

router.get('/profile', authenticate, authorizeClient, getClientProfile);
router.put('/profile', authenticate, authorizeClient, updateClientProfile);
router.get('/stats', authenticate, authorizeClient, getClientStats);

export default router;