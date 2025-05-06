import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import { body } from 'express-validator';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty(),
    body('role').isIn(['CLIENT', 'MERCHANT']),
    body('businessName').if(body('role').equals('MERCHANT')).notEmpty(),
    body('address').if(body('role').equals('MERCHANT')).notEmpty(),
    body('latitude').if(body('role').equals('MERCHANT')).isFloat(),
    body('longitude').if(body('role').equals('MERCHANT')).isFloat(),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  login
);

export default router;