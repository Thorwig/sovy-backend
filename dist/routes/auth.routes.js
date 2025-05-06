"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail(),
    (0, express_validator_1.body)('password').isLength({ min: 6 }),
    (0, express_validator_1.body)('name').notEmpty(),
    (0, express_validator_1.body)('role').isIn(['CLIENT', 'MERCHANT']),
    (0, express_validator_1.body)('businessName').if((0, express_validator_1.body)('role').equals('MERCHANT')).notEmpty(),
    (0, express_validator_1.body)('address').if((0, express_validator_1.body)('role').equals('MERCHANT')).notEmpty(),
    (0, express_validator_1.body)('latitude').if((0, express_validator_1.body)('role').equals('MERCHANT')).isFloat(),
    (0, express_validator_1.body)('longitude').if((0, express_validator_1.body)('role').equals('MERCHANT')).isFloat(),
], auth_controller_1.register);
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail(),
    (0, express_validator_1.body)('password').notEmpty(),
], auth_controller_1.login);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map