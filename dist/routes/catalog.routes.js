"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../db/prisma"));
exports.catalogRouter = (0, express_1.Router)();
// GET /api/catalog/products
exports.catalogRouter.get('/products', async (req, res) => {
    try {
        const { search, category, brand, inStock, sort, page = '1', limit = '24', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
        const skip = (pageNum - 1) * limitNum;
        const where = {};
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            where.OR = [
                { title: { contains: q } },
                { brand: { contains: q } },
                { category: { contains: q } },
            ];
        }
        if (category && typeof category === 'string' && category !== 'ALL') {
            where.category = category;
        }
        if (brand && typeof brand === 'string' && brand !== 'ALL') {
            where.brand = brand;
        }
        if (inStock === 'true') {
            where.inStock = true;
        }
        let orderBy = { createdAt: 'desc' };
        if (sort === 'price_asc') {
            orderBy = { calculatedPrice: 'asc' };
        }
        else if (sort === 'price_desc') {
            orderBy = { calculatedPrice: 'desc' };
        }
        else if (sort === 'title_asc') {
            orderBy = { title: 'asc' };
        }
        const [total, products] = await Promise.all([
            prisma_1.default.product.count({ where }),
            prisma_1.default.product.findMany({
                where,
                orderBy,
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
// GET /api/catalog/products/:id
exports.catalogRouter.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await prisma_1.default.product.findUnique({
            where: { id },
        });
        if (!product) {
            res.status(404).json({ success: false, error: 'Producto no encontrado' });
            return;
        }
        res.json({ success: true, data: product });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/catalog/categories
exports.catalogRouter.get('/categories', async (_req, res) => {
    try {
        const categories = await prisma_1.default.product.groupBy({
            by: ['category'],
            _count: { id: true },
            orderBy: { category: 'asc' },
        });
        res.json({
            success: true,
            data: categories.map(c => ({
                name: c.category,
                count: c._count.id,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// GET /api/catalog/brands
exports.catalogRouter.get('/brands', async (_req, res) => {
    try {
        const brands = await prisma_1.default.product.groupBy({
            by: ['brand'],
            _count: { id: true },
            orderBy: { brand: 'asc' },
        });
        res.json({
            success: true,
            data: brands.map(b => ({
                name: b.brand,
                count: b._count.id,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
