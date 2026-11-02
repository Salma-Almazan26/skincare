import prisma from '../db/prisma';
import { ENV } from '../config/environment';

export class PricingService {
  private static readonly MARGIN_KEY = 'profit_margin_percentage';

  /**
   * Obtiene el porcentaje de margen activo desde la base de datos o fallback de entorno
   */
  static async getActiveMargin(): Promise<number> {
    const config = await prisma.config.findUnique({
      where: { key: this.MARGIN_KEY },
    });

    if (config && config.value) {
      const parsed = parseFloat(config.value);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return ENV.DEFAULT_MARGIN_PERCENT;
  }

  /**
   * Calcula el precio final a partir del precio base y el margen
   */
  static computePrice(basePrice: number, marginPercent: number): number {
    const factor = 1 + marginPercent / 100;
    const rawPrice = basePrice * factor;
    // Redondear a 2 decimales
    return Math.round(rawPrice * 100) / 100;
  }

  /**
   * Actualiza el margen en la tabla Config y opcionalmente recalcula todos los productos
   */
  static async updateMargin(newMargin: number, recalculateAllProducts = true): Promise<{ margin: number; updatedProductsCount: number }> {
    if (newMargin < 0) {
      throw new Error('El margen porcentual no puede ser negativo.');
    }

    await prisma.config.upsert({
      where: { key: this.MARGIN_KEY },
      update: { value: newMargin.toString() },
      create: { key: this.MARGIN_KEY, value: newMargin.toString() },
    });

    let updatedCount = 0;

    if (recalculateAllProducts) {
      const products = await prisma.product.findMany();
      for (const p of products) {
        const newCalculated = this.computePrice(p.basePrice, newMargin);
        await prisma.product.update({
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

