"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const order_controller_1 = require("../controllers/order.controller");
const router = (0, express_1.Router)();
router.post('/', auth_middleware_1.authenticate, order_controller_1.createOrder);
router.get('/user', auth_middleware_1.authenticate, order_controller_1.getUserOrders);
router.get('/merchant', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, order_controller_1.getMerchantOrders);
router.patch('/:id/status', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, order_controller_1.updateOrderStatus);
exports.default = router;
//# sourceMappingURL=order.routes.js.map