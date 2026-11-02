import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';

export const catalogRouter = Router();

// GET /api/catalog/products
catalogRouter.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      category,
      brand,
      inStock,
      sort,
      page = '1',
      limit = '24',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 24));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

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

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'price_asc') {
      orderBy = { calculatedPrice: 'asc' };
    } else if (sort === 'price_desc') {
      orderBy = { calculatedPrice: 'desc' };
    } else if (sort === 'title_asc') {
      orderBy = { title: 'asc' };
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/catalog/products/:id
catalogRouter.get('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ success: false, error: 'Producto no encontrado' });
      return;
    }

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/catalog/categories
catalogRouter.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.product.groupBy({
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/catalog/brands
catalogRouter.get('/brands', async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await prisma.product.groupBy({
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

