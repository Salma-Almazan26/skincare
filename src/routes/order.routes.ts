import { Router, Request, Response } from 'express';
import { OrderService } from '../services/order.service';

export const orderRouter = Router();

// POST /api/orders/checkout
orderRouter.post('/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await OrderService.createOrder(req.body);
    res.status(201).json({
      success: true,
      data: {
        order: result.order,
        whatsappLink: result.whatsappLink,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error?.message || 'Error al procesar el pedido',
    });
  }
});

// GET /api/orders/track/:orderNumber
orderRouter.get('/track/:orderNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const orderNumber = parseInt(req.params.orderNumber, 10);
    if (isNaN(orderNumber)) {
      res.status(400).json({ success: false, error: 'Número de orden inválido' });
      return;
    }

    const order = await OrderService.getOrderByNumber(orderNumber);
    if (!order) {
      res.status(404).json({ success: false, error: 'Orden no encontrada' });
      return;
    }

    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

