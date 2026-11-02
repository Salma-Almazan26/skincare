"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const auth_service_1 = require("../services/auth.service");
function requireAuth(req, res, next) {
    // Check HttpOnly cookie first, then Bearer Authorization header
    let token = req.cookies?.token;
    if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            token = parts[1];
        }
    }
    if (!token) {
        res.status(401).json({
            success: false,
            error: 'Acceso no autorizado. Se requiere iniciar sesión.',
        });
        return;
    }
    const payload = auth_service_1.AuthService.verifyToken(token);
    if (!payload) {
        res.status(401).json({
            success: false,
            error: 'Sesión expirada o token inválido.',
        });
        return;
    }
    req.user = payload;
    next();
}
