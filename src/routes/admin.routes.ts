import { Router, Response } from 'express';
import prisma from '../db/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { PricingService } from '../services/pricing.service';
import { ScraperService } from '../services/scraper.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { z } from 'zod';

export const adminRouter = Router();

// Todas las rutas admin requieren autenticación JWT
adminRouter.use(requireAuth);

// GET /api/admin/metrics
adminRouter.get('/metrics', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalProducts,
      outOfStockProducts,
      activeMargin,
      salesResult,
      lastLog,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'CONFIRMED' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.product.count(),
      prisma.product.count({ where: { inStock: false } }),
      PricingService.getActiveMargin(),
      prisma.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
      }),
      prisma.scrapingLog.findFirst({
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/orders
adminRouter.get('/orders', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

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
      prisma.order.count({ where }),
      prisma.order.findMany({
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
      customerWhatsAppLink: WhatsAppService.generateCustomerContactLink(
        ord.customer.phone,
        ord.orderNumber,
        ord.customer.name
      ),
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/orders/:id/status
const UpdateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

adminRouter.patch('/orders/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = UpdateStatusSchema.parse(req.body);

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { customer: true },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Error al actualizar estado' });
  }
});

// GET /api/admin/products
adminRouter.get('/products', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, category, inStock, page = '1', limit = '30' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

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

    if (inStock === 'true') where.inStock = true;
    if (inStock === 'false') where.inStock = false;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/products/:id
adminRouter.patch('/products/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { inStock, basePrice, title, category } = req.body;

    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) {
      res.status(404).json({ success: false, error: 'Producto no encontrado' });
      return;
    }

    const dataToUpdate: any = {};
    if (typeof inStock === 'boolean') dataToUpdate.inStock = inStock;
    if (title && typeof title === 'string') dataToUpdate.title = title.trim();
    if (category && typeof category === 'string') dataToUpdate.category = category.trim();

    if (typeof basePrice === 'number' && basePrice > 0) {
      const activeMargin = await PricingService.getActiveMargin();
      dataToUpdate.basePrice = basePrice;
      dataToUpdate.calculatedPrice = PricingService.computePrice(basePrice, activeMargin);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/admin/config
adminRouter.get('/config', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.config.findMany();
    const configMap: Record<string, string> = {};
    configs.forEach(c => {
      configMap[c.key] = c.value;
    });

    const activeMargin = await PricingService.getActiveMargin();
    const storePhone = await WhatsAppService.getStorePhone();

    res.json({
      success: true,
      data: {
        profitMargin: activeMargin,
        storePhone: storePhone,
        allConfigs: configMap,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/admin/config
const UpdateConfigSchema = z.object({
  profitMargin: z.number().min(0, 'El margen no puede ser negativo').optional(),
  recalculateAllPrices: z.boolean().optional(),
  storePhone: z.string().min(10, 'El teléfono debe tener al menos 10 dígitos').optional(),
});

adminRouter.patch('/config', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { profitMargin, recalculateAllPrices = true, storePhone } = UpdateConfigSchema.parse(req.body);

    let marginResult = null;
    if (typeof profitMargin === 'number') {
      marginResult = await PricingService.updateMargin(profitMargin, recalculateAllPrices);
    }

    if (storePhone) {
      const clean = storePhone.replace(/\D/g, '');
      await prisma.config.upsert({
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
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Error al actualizar configuración' });
  }
});

// POST /api/admin/scraper/run
adminRouter.post('/scraper/run', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await ScraperService.runSync('ADMIN_MANUAL_TRIGGER');
    res.json({
      success: result.success,
      data: result,
      message: (result as any).message || (result.success
        ? `Sincronización completada exitosamente. ${result.productsUpserted} productos actualizados.`
        : `Error en la sincronización: ${result.errorMessage}`),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/scraper/logs
adminRouter.get('/scraper/logs', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const logs = await prisma.scrapingLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

