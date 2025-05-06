"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const client_controller_1 = require("../controllers/client.controller");
const router = (0, express_1.Router)();
router.get('/profile', auth_middleware_1.authenticate, auth_middleware_1.authorizeClient, client_controller_1.getClientProfile);
router.put('/profile', auth_middleware_1.authenticate, auth_middleware_1.authorizeClient, client_controller_1.updateClientProfile);
router.get('/stats', auth_middleware_1.authenticate, auth_middleware_1.authorizeClient, client_controller_1.getClientStats);
exports.default = router;
//# sourceMappingURL=client.routes.js.map