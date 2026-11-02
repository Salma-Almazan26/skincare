import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { STYLEVANA_CATALOG_DATA } from '../src/services/scraper.service';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Iniciando inicialización de la base de datos...');

  // 1. Crear usuario Administrador
  const adminEmail = 'admin@kbeauty.mx';
  const plainPassword = 'Admin123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      name: 'Directora K-Beauty',
      role: 'ADMIN',
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Directora K-Beauty',
      role: 'ADMIN',
    },
  });
  console.log(`[Seed] Administrador configurado: ${admin.email} (Contraseña: ${plainPassword})`);

  // 2. Parámetros de Configuración Global
  const defaultMargin = 30; // 30% de margen
  await prisma.config.upsert({
    where: { key: 'profit_margin_percentage' },
    update: { value: defaultMargin.toString() },
    create: { key: 'profit_margin_percentage', value: defaultMargin.toString() },
  });

  await prisma.config.upsert({
    where: { key: 'store_whatsapp_phone' },
    update: { value: '524531503575' },
    create: { key: 'store_whatsapp_phone', value: '524531503575' },
  });

  await prisma.config.upsert({
    where: { key: 'store_name' },
    update: { value: 'K-Beauty México Official' },
    create: { key: 'store_name', value: 'K-Beauty México Official' },
  });
  console.log(`[Seed] Configuraciones iniciales aplicadas (Margen: ${defaultMargin}%, WhatsApp: +52 55 1234 5678)`);

  // 3. Sembrar catálogo sincronizado desde Stylevana México
  console.log(`[Seed] Sincronizando catálogo con ${STYLEVANA_CATALOG_DATA.length} productos base de Stylevana...`);
  for (const item of STYLEVANA_CATALOG_DATA) {
    const calculatedPrice = Math.round(item.basePrice * (1 + defaultMargin / 100) * 100) / 100;

    await prisma.product.upsert({
      where: { externalId: item.externalId },
      update: {
        title: item.title,
        brand: item.brand,
        category: item.category,
        stylevanaUrl: item.stylevanaUrl,
        imageUrl: item.imageUrl,
        basePrice: item.basePrice,
        calculatedPrice: calculatedPrice,
        inStock: item.inStock,
      },
      create: {
        externalId: item.externalId,
        title: item.title,
        brand: item.brand,
        category: item.category,
        stylevanaUrl: item.stylevanaUrl,
        imageUrl: item.imageUrl,
        basePrice: item.basePrice,
        calculatedPrice: calculatedPrice,
        inStock: item.inStock,
      },
    });
  }

  const validExternalIds = STYLEVANA_CATALOG_DATA.map((i) => i.externalId);
  await prisma.product.deleteMany({
    where: {
      externalId: { notIn: validExternalIds },
      orderItems: { none: {} },
    },
  });

  console.log(`[Seed] ${STYLEVANA_CATALOG_DATA.length} productos sincronizados con margen del ${defaultMargin}%.`);

  // 4. Crear cliente y orden de muestra inicial para métricas
  const customer = await prisma.customer.upsert({
    where: { phone: '525598765432' },
    update: {},
    create: {
      phone: '525598765432',
      name: 'Sofía Navarro Cruz',
      street: 'Av. Paseo de la Reforma',
      exteriorNumber: '222',
      interiorNumber: 'Piso 8, Depto 804',
      neighborhood: 'Juárez, Cuauhtémoc',
      city: 'Ciudad de México',
      state: 'CDMX',
      postalCode: '06600',
      references: 'Torre de cristal frente a glorieta',
    },
  });

  const bojProduct = await prisma.product.findUnique({
    where: { externalId: 'BOJ-RELIEF-SUN-50' },
  });
  const cosrxProduct = await prisma.product.findUnique({
    where: { externalId: 'COSRX-SNAIL-96-100' },
  });

  if (bojProduct && cosrxProduct) {
    const existingOrder = await prisma.order.findFirst({
      where: { customerId: customer.id },
    });

    if (!existingOrder) {
      const orderTotal = Math.round((bojProduct.calculatedPrice * 2 + cosrxProduct.calculatedPrice) * 100) / 100;
      await prisma.order.create({
        data: {
          orderNumber: 1001,
          customerId: customer.id,
          totalAmount: orderTotal,
          status: 'CONFIRMED',
          items: {
            create: [
              {
                productId: bojProduct.id,
                quantity: 2,
                unitPrice: bojProduct.calculatedPrice,
              },
              {
                productId: cosrxProduct.id,
                quantity: 1,
                unitPrice: cosrxProduct.calculatedPrice,
              },
            ],
          },
        },
      });
      console.log('[Seed] Pedido inicial de muestra #1001 generado con éxito.');
    }
  }

  // 5. Registrar log de scraping inicial
  await prisma.scrapingLog.create({
    data: {
      startedAt: new Date(Date.now() - 3600000), // Hace 1 hora
      completedAt: new Date(Date.now() - 3550000),
      status: 'SUCCESS',
      productsUpserted: STYLEVANA_CATALOG_DATA.length,
      errorMessage: null,
    },
  });

  console.log('[Seed] Inicialización completada exitosamente.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

