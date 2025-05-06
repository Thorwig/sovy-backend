"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const merchant_controller_1 = require("../controllers/merchant.controller");
const router = (0, express_1.Router)();
router.get('/profile', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, merchant_controller_1.getMerchantProfile);
router.put('/profile', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, merchant_controller_1.updateMerchantProfile);
router.get('/stats', auth_middleware_1.authenticate, auth_middleware_1.authorizeMerchant, merchant_controller_1.getMerchantStats);
exports.default = router;
//# sourceMappingURL=merchant.routes.js.map