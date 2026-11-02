"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = exports.CheckoutSchema = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
const whatsapp_service_1 = require("./whatsapp.service");
const zod_1 = require("zod");
exports.CheckoutSchema = zod_1.z.object({
    customer: zod_1.z.object({
        name: zod_1.z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
        phone: zod_1.z.string().min(10, 'El teléfono debe tener al menos 10 dígitos'),
        street: zod_1.z.string().min(2, 'La calle es obligatoria'),
        exteriorNumber: zod_1.z.string().min(1, 'El número exterior es obligatorio'),
        interiorNumber: zod_1.z.string().optional().nullable(),
        neighborhood: zod_1.z.string().min(2, 'La colonia es obligatoria'),
        city: zod_1.z.string().min(2, 'La ciudad es obligatoria'),
        state: zod_1.z.string().min(2, 'El estado es obligatorio'),
        postalCode: zod_1.z.string().min(4, 'El código postal es obligatorio'),
        references: zod_1.z.string().optional().nullable(),
    }),
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().positive('La cantidad debe ser mayor a 0'),
    })).min(1, 'El carrito debe tener al menos un producto'),
});
class OrderService {
    static async createOrder(data) {
        const validated = exports.CheckoutSchema.parse(data);
        // 1. Normalizar teléfono
        const cleanPhone = validated.customer.phone.replace(/\D/g, '');
        // 2. Upsert Cliente
        const customer = await prisma_1.default.customer.upsert({
            where: { phone: cleanPhone },
            update: {
                name: validated.customer.name,
                street: validated.customer.street,
                exteriorNumber: validated.customer.exteriorNumber,
                interiorNumber: validated.customer.interiorNumber || null,
                neighborhood: validated.customer.neighborhood,
                city: validated.customer.city,
                state: validated.customer.state,
                postalCode: validated.customer.postalCode,
                references: validated.customer.references || null,
            },
            create: {
                phone: cleanPhone,
                name: validated.customer.name,
                street: validated.customer.street,
                exteriorNumber: validated.customer.exteriorNumber,
                interiorNumber: validated.customer.interiorNumber || null,
                neighborhood: validated.customer.neighborhood,
                city: validated.customer.city,
                state: validated.customer.state,
                postalCode: validated.customer.postalCode,
                references: validated.customer.references || null,
            },
        });
        // 3. Buscar productos y validar stock / precios
        const productIds = validated.items.map(i => i.productId);
        const dbProducts = await prisma_1.default.product.findMany({
            where: { id: { in: productIds } },
        });
        if (dbProducts.length !== productIds.length) {
            throw new Error('Uno o más productos del carrito ya no se encuentran disponibles.');
        }
        const productMap = new Map(dbProducts.map(p => [p.id, p]));
        let totalAmount = 0;
        const orderItemsData = validated.items.map(item => {
            const prod = productMap.get(item.productId);
            const unitPrice = prod.calculatedPrice;
            const subtotal = unitPrice * item.quantity;
            totalAmount += subtotal;
            return {
                productId: prod.id,
                quantity: item.quantity,
                unitPrice: unitPrice,
            };
        });
        // 4. Calcular orderNumber (autoincrement seguro independiente del motor DB)
        const lastOrder = await prisma_1.default.order.findFirst({
            orderBy: { orderNumber: 'desc' },
            select: { orderNumber: true },
        });
        const nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1001;
        // 5. Crear la orden y sus items en transacción
        const order = await prisma_1.default.order.create({
            data: {
                orderNumber: nextOrderNumber,
                customerId: customer.id,
                totalAmount: Math.round(totalAmount * 100) / 100,
                status: 'PENDING',
                items: {
                    create: orderItemsData,
                },
            },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
        // 6. Generar mensaje y enlace de WhatsApp
        const whatsappData = {
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount,
            customer: {
                name: customer.name,
                phone: customer.phone,
                street: customer.street,
                exteriorNumber: customer.exteriorNumber,
                interiorNumber: customer.interiorNumber,
                neighborhood: customer.neighborhood,
                city: customer.city,
                state: customer.state,
                postalCode: customer.postalCode,
                references: customer.references,
            },
            items: order.items.map(it => ({
                title: it.product.title,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
            })),
        };
        const whatsappLink = await whatsapp_service_1.WhatsAppService.generateOrderLink(whatsappData);
        return {
            order,
            whatsappLink,
        };
    }
    static async getOrderByNumber(orderNumber) {
        return prisma_1.default.order.findUnique({
            where: { orderNumber },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });
    }
}
exports.OrderService = OrderService;
