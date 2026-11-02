"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const catalog_routes_1 = require("./routes/catalog.routes");
const order_routes_1 = require("./routes/order.routes");
const auth_routes_1 = require("./routes/auth.routes");
const admin_routes_1 = require("./routes/admin.routes");
exports.app = (0, express_1.default)();
// Middlewares globales
exports.app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
}));
exports.app.use((0, cookie_parser_1.default)());
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: true }));
// Servir archivos estáticos del frontend
const publicPath = path_1.default.join(process.cwd(), 'public');
exports.app.use(express_1.default.static(publicPath));
// Rutas API
exports.app.use('/api/catalog', catalog_routes_1.catalogRouter);
exports.app.use('/api/orders', order_routes_1.orderRouter);
exports.app.use('/api/auth', auth_routes_1.authRouter);
exports.app.use('/api/admin', admin_routes_1.adminRouter);
// Health check
exports.app.get('/api/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'K-Beauty E-commerce Engine',
    });
});
// Enrutamiento frontend amigable
exports.app.get('/admin', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'admin.html'));
});
exports.app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
        return;
    }
    res.sendFile(path_1.default.join(publicPath, 'index.html'));
});
// Manejador global de errores
exports.app.use((err, _req, res, _next) => {
    console.error('[Error Global]', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor',
    });
});
exports.default = exports.app;
