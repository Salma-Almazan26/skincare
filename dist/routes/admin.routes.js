"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../db/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const pricing_service_1 = require("../services/pricing.service");
const scraper_service_1 = require("../services/scraper.service");
const whatsapp_service_1 = require("../services/whatsapp.service");
const zod_1 = require("zod");
exports.adminRouter = (0, express_1.Router)();
// Todas las rutas admin requieren autenticación JWT
exports.adminRouter.use(auth_middleware_1.requireAuth);
// GET /api/admin/metrics
exports.adminRouter.get('/metrics', async (_req, res) => {
    try {
        const [totalOrders, pendingOrders, confirmedOrders, shippedOrders, deliveredOrders, cancelledOrders, totalProducts, outOfStockProducts, activeMargin, salesResult, lastLog,] = await Promise.all([
            prisma_1.default.order.count(),
            prisma_1.default.order.count({ where: { status: 'PENDING' } }),
            prisma_1.default.order.count({ where: { status: 'CONFIRMED' } }),
            prisma_1.default.order.count({ where: { status: 'SHIPPED' } }),
            prisma_1.default.order.count({ where: { status: 'DELIVERED' } }),
            prisma_1.default.order.count({ where: { status: 'CANCELLED' } }),
            prisma_1.default.product.count(),
            prisma_1.default.product.count({ where: { inStock: false } }),
            pricing_service_1.PricingService.getActiveMargin(),
            prisma_1.default.order.aggregate({
                where: { status: { not: 'CANCELLED' } },
                _sum: { totalAmount: true },
            }),
            prisma_1.default.scrapingLog.findFirst({
                orderBy: { startedAt: 'desc' },
            }),
        ]);
        const totalRevenue = salesResult._sum.totalAmount || 0;
        res.json({
            success: true,
            data: {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalOrders,
                pendingOrders,
                confirmedOrders,
                shippedOrders,
                deliveredOrders,
                cancelledOrders,
                totalProducts,
                outOfStockProducts,
                activeMargin,
                lastScrapingLog: lastLog,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/admin/orders
exports.adminRouter.get('/orders', async (req, res) => {
    try {
        const { status, search, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (status && typeof status === 'string' && status !== 'ALL') {
            where.status = status;
        }
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            const numQ = parseInt(q, 10);
            where.OR = [
                { customer: { name: { contains: q } } },
                { customer: { phone: { contains: q } } },
                ...(isNaN(numQ) ? [] : [{ orderNumber: numQ }]),
            ];
        }
        const [total, orders] = await Promise.all([
            prisma_1.default.order.count({ where }),
            prisma_1.default.order.findMany({
                where,
                include: {
                    customer: true,
                    items: {
                        include: {
                            product: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        // Añadir enlace de contacto WhatsApp para cada orden
        const enrichedOrders = orders.map(ord => ({
            ...ord,
            customerWhatsAppLink: whatsapp_service_1.WhatsAppService.generateCustomerContactLink(ord.customer.phone, ord.orderNumber, ord.customer.name),
        }));
        res.json({
            success: true,
            data: enrichedOrders,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// PATCH /api/admin/orders/:id/status
const UpdateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});
exports.adminRouter.patch('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = UpdateStatusSchema.parse(req.body);
        const updated = await prisma_1.default.order.update({
            where: { id },
            data: { status },
            include: { customer: true },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error?.message || 'Error al actualizar estado' });
    }
});
// GET /api/admin/products
exports.adminRouter.get('/products', async (req, res) => {
    try {
        const { search, category, inStock, page = '1', limit = '30' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            where.OR = [
                { title: { contains: q } },
                { brand: { contains: q } },
                { externalId: { contains: q } },
            ];
        }
        if (category && typeof category === 'string' && category !== 'ALL') {
            where.category = category;
        }
        if (inStock === 'true')
            where.inStock = true;
        if (inStock === 'false')
            where.inStock = false;
        const [total, products] = await Promise.all([
            prisma_1.default.product.count({ where }),
            prisma_1.default.product.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        res.json({
            success: true,
            data: products,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// PATCH /api/admin/products/:id
exports.adminRouter.patch('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { inStock, basePrice, title, category } = req.body;
        const current = await prisma_1.default.product.findUnique({ where: { id } });
        if (!current) {
            res.status(404).json({ success: false, error: 'Producto no encontrado' });
            return;
        }
        const dataToUpdate = {};
        if (typeof inStock === 'boolean')
            dataToUpdate.inStock = inStock;
        if (title && typeof title === 'string')
            dataToUpdate.title = title.trim();
        if (category && typeof category === 'string')
            dataToUpdate.category = category.trim();
        if (typeof basePrice === 'number' && basePrice > 0) {
            const activeMargin = await pricing_service_1.PricingService.getActiveMargin();
            dataToUpdate.basePrice = basePrice;
            dataToUpdate.calculatedPrice = pricing_service_1.PricingService.computePrice(basePrice, activeMargin);
        }
        const updated = await prisma_1.default.product.update({
            where: { id },
            data: dataToUpdate,
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
// GET /api/admin/config
exports.adminRouter.get('/config', async (_req, res) => {
    try {
        const configs = await prisma_1.default.config.findMany();
        const configMap = {};
        configs.forEach(c => {
            configMap[c.key] = c.value;
        });
        const activeMargin = await pricing_service_1.PricingService.getActiveMargin();
        const storePhone = await whatsapp_service_1.WhatsAppService.getStorePhone();
        res.json({
            success: true,
            data: {
                profitMargin: activeMargin,
                storePhone: storePhone,
                allConfigs: configMap,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// PATCH /api/admin/config
const UpdateConfigSchema = zod_1.z.object({
    profitMargin: zod_1.z.number().min(0, 'El margen no puede ser negativo').optional(),
    recalculateAllPrices: zod_1.z.boolean().optional(),
    storePhone: zod_1.z.string().min(10, 'El teléfono debe tener al menos 10 dígitos').optional(),
});
exports.adminRouter.patch('/config', async (req, res) => {
    try {
        const { profitMargin, recalculateAllPrices = true, storePhone } = UpdateConfigSchema.parse(req.body);
        let marginResult = null;
        if (typeof profitMargin === 'number') {
            marginResult = await pricing_service_1.PricingService.updateMargin(profitMargin, recalculateAllPrices);
        }
        if (storePhone) {
            const clean = storePhone.replace(/\D/g, '');
            await prisma_1.default.config.upsert({
                where: { key: 'store_whatsapp_phone' },
                update: { value: clean },
                create: { key: 'store_whatsapp_phone', value: clean },
            });
        }
        res.json({
            success: true,
            message: 'Configuración actualizada exitosamente',
            data: {
                marginResult,
                storePhone,
            },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error?.message || 'Error al actualizar configuración' });
    }
});
// POST /api/admin/scraper/run
exports.adminRouter.post('/scraper/run', async (_req, res) => {
    try {
        const result = await scraper_service_1.ScraperService.runSync('ADMIN_MANUAL_TRIGGER');
        res.json({
            success: result.success,
            data: result,
            message: result.message || (result.success
                ? `Sincronización completada exitosamente. ${result.productsUpserted} productos actualizados.`
                : `Error en la sincronización: ${result.errorMessage}`),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/admin/scraper/logs
exports.adminRouter.get('/scraper/logs', async (_req, res) => {
    try {
        const logs = await prisma_1.default.scrapingLog.findMany({
            orderBy: { startedAt: 'desc' },
            take: 20,
        });
        res.json({ success: true, data: logs });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
