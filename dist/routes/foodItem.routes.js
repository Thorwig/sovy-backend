"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const foodItem_controller_1 = require("../controllers/foodItem.controller");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
router.get('/', foodItem_controller_1.getFoodItems);
router.get('/nearby', foodItem_controller_1.getNearbyFoodItems);
router.get('/favorites', auth_middleware_1.authenticate, foodItem_controller_1.getFavoriteFoodItems);
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, upload.single('image'), foodItem_controller_1.createFoodItem);
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, upload.single('image'), foodItem_controller_1.updateFoodItem);
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, foodItem_controller_1.deleteFoodItem);
router.post('/:foodItemId/favorite', auth_middleware_1.authenticate, foodItem_controller_1.toggleFavorite);
exports.default = router;
//# sourceMappingURL=foodItem.routes.js.map