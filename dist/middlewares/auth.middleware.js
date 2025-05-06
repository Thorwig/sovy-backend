"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeClient = exports.authorizeMerchant = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticate = async (req, res, next) => {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not defined');
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Authorization header is missing' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        const merchant = await prisma.merchant.findUnique({ where: { id: decoded.userId } });
        if (!user && !merchant) {
            return res.status(401).json({ message: 'User not found' });
        }
        req.user = decoded;
        return next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        return res.status(500).json({ message: 'Authentication error' });
    }
};
exports.authenticate = authenticate;
const authorizeMerchant = (req, res, next) => {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'MERCHANT') {
        return res.status(403).json({ message: 'Merchant access required' });
    }
    return next();
};
exports.authorizeMerchant = authorizeMerchant;
const authorizeClient = (req, res, next) => {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'CLIENT') {
        return res.status(403).json({ message: 'Client access required' });
    }
    return next();
};
exports.authorizeClient = authorizeClient;
//# sourceMappingURL=auth.middleware.js.map