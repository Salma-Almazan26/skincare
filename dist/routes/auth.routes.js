"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../db/prisma"));
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const zod_1 = require("zod");
exports.authRouter = (0, express_1.Router)();
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Correo electrónico inválido'),
    password: zod_1.z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});
// POST /api/auth/login
exports.authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        const admin = await prisma_1.default.adminUser.findUnique({
            where: { email: email.toLowerCase().trim() },
        });
        if (!admin) {
            res.status(401).json({ success: false, error: 'Credenciales inválidas' });
            return;
        }
        const isValid = await auth_service_1.AuthService.comparePassword(password, admin.password);
        if (!isValid) {
            res.status(401).json({ success: false, error: 'Credenciales inválidas' });
            return;
        }
        const token = auth_service_1.AuthService.generateToken({
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        });
        // Enviar cookie HttpOnly
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 horas
        });
        res.json({
            success: true,
            data: {
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                },
                token,
            },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error?.message || 'Error al iniciar sesión',
        });
    }
});
// POST /api/auth/logout
exports.authRouter.post('/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
});
// GET /api/auth/me
exports.authRouter.get('/me', auth_middleware_1.requireAuth, (req, res) => {
    res.json({ success: true, data: req.user });
});
