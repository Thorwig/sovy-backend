import { Router } from 'express';
import { authenticate, authorizeMerchant } from '../middlewares/auth.middleware';
import { 
  createFoodItem, 
  getFoodItems,
  getFoodItemById, 
  getNearbyFoodItems,
  getFavoriteFoodItems,
  updateFoodItem, 
  deleteFoodItem, 
  toggleFavorite 
} from '../controllers/foodItem.controller';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Public routes
router.get('/', getFoodItems);
router.get('/nearby', getNearbyFoodItems);
router.get('/favorites', authenticate, getFavoriteFoodItems);
router.get('/:id', getFoodItemById);

// Protected routes
router.post('/', authenticate, authorizeMerchant, upload.single('image'), createFoodItem);
router.put('/:id', authenticate, authorizeMerchant, upload.single('image'), updateFoodItem);
router.delete('/:id', authenticate, authorizeMerchant, deleteFoodItem);
router.post('/:foodItemId/favorite', authenticate, toggleFavorite);

export default router;