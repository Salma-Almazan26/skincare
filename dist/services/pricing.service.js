"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
const prisma_1 = __importDefault(require("../db/prisma"));
const environment_1 = require("../config/environment");
class PricingService {
    static MARGIN_KEY = 'profit_margin_percentage';
    /**
     * Obtiene el porcentaje de margen activo desde la base de datos o fallback de entorno
     */
    static async getActiveMargin() {
        const config = await prisma_1.default.config.findUnique({
            where: { key: this.MARGIN_KEY },
        });
        if (config && config.value) {
            const parsed = parseFloat(config.value);
            if (!isNaN(parsed) && parsed >= 0) {
                return parsed;
            }
        }
        return environment_1.ENV.DEFAULT_MARGIN_PERCENT;
    }
    /**
     * Calcula el precio final a partir del precio base y el margen
     */
    static computePrice(basePrice, marginPercent) {
        const factor = 1 + marginPercent / 100;
        const rawPrice = basePrice * factor;
        // Redondear a 2 decimales
        return Math.round(rawPrice * 100) / 100;
    }
    /**
     * Actualiza el margen en la tabla Config y opcionalmente recalcula todos los productos
     */
    static async updateMargin(newMargin, recalculateAllProducts = true) {
        if (newMargin < 0) {
            throw new Error('El margen porcentual no puede ser negativo.');
        }
        await prisma_1.default.config.upsert({
            where: { key: this.MARGIN_KEY },
            update: { value: newMargin.toString() },
            create: { key: this.MARGIN_KEY, value: newMargin.toString() },
        });
        let updatedCount = 0;
        if (recalculateAllProducts) {
            const products = await prisma_1.default.product.findMany();
            for (const p of products) {
                const newCalculated = this.computePrice(p.basePrice, newMargin);
                await prisma_1.default.product.update({
                    where: { id: p.id },
                    data: { calculatedPrice: newCalculated },
                });
                updatedCount++;
            }
        }
        return {
            margin: newMargin,
            updatedProductsCount: updatedCount,
        };
    }
}
exports.PricingService = PricingService;
