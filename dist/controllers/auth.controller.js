"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const geocoding_service_1 = require("../services/geocoding.service");
const prisma = new client_1.PrismaClient();
const register = async (req, res) => {
    try {
        const { email, password, name, role, businessName, address, city, postalCode } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({
                message: 'Email, password, and name are required'
            });
        }
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        const existingMerchant = await prisma.merchant.findUnique({ where: { email } });
        if (existingUser || existingMerchant) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        if (role === 'MERCHANT') {
            if (!businessName || !address || !city || !postalCode) {
                return res.status(400).json({
                    message: 'Business name, address, city, and postal code are required for merchant registration'
                });
            }
            try {
                const { lat, lon } = await (0, geocoding_service_1.geocodeAddress)(address, city, postalCode);
                const merchant = await prisma.merchant.create({
                    data: {
                        email,
                        password: hashedPassword,
                        name,
                        businessName,
                        address,
                        city,
                        postalCode,
                        latitude: lat,
                        longitude: lon,
                    },
                });
                const token = jsonwebtoken_1.default.sign({ userId: merchant.id, role: 'MERCHANT' }, process.env.JWT_SECRET, { expiresIn: '7d' });
                const { password: _, ...merchantData } = merchant;
                return res.status(201).json({ token, merchant: merchantData });
            }
            catch (error) {
                if (error instanceof Error) {
                    return res.status(400).json({
                        message: `Address validation failed: ${error.message}`
                    });
                }
                throw error;
            }
        }
        else {
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: 'CLIENT',
                },
            });
            const token = jsonwebtoken_1.default.sign({ userId: user.id, role: 'CLIENT' }, process.env.JWT_SECRET, { expiresIn: '7d' });
            const { password: _, ...userData } = user;
            return res.status(201).json({ token, user: userData });
        }
    }
    catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: 'Server error during registration' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        const merchant = await prisma.merchant.findUnique({ where: { email } });
        if (!user && !merchant) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const account = user || merchant;
        const isValidPassword = await bcryptjs_1.default.compare(password, account.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: account.id, role: user ? 'CLIENT' : 'MERCHANT' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            token,
            user: { ...account, password: undefined },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Server error during login' });
    }
};
exports.login = login;
//# sourceMappingURL=auth.controller.js.map