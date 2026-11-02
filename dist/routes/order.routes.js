"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const express_1 = require("express");
const order_service_1 = require("../services/order.service");
exports.orderRouter = (0, express_1.Router)();
// POST /api/orders/checkout
exports.orderRouter.post('/checkout', async (req, res) => {
    try {
        const result = await order_service_1.OrderService.createOrder(req.body);
        res.status(201).json({
            success: true,
            data: {
                order: result.order,
                whatsappLink: result.whatsappLink,
            },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error?.message || 'Error al procesar el pedido',
        });
    }
});
// GET /api/orders/track/:orderNumber
exports.orderRouter.get('/track/:orderNumber', async (req, res) => {
    try {
        const orderNumber = parseInt(req.params.orderNumber, 10);
        if (isNaN(orderNumber)) {
            res.status(400).json({ success: false, error: 'Número de orden inválido' });
            return;
        }
        const order = await order_service_1.OrderService.getOrderByNumber(orderNumber);
        if (!order) {
            res.status(404).json({ success: false, error: 'Orden no encontrada' });
            return;
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
