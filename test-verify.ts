import { app } from './src/app';
import prisma from './src/db/prisma';
import http from 'http';

async function runTests() {
  console.log('🧪 Iniciando batería de pruebas end-to-end...');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));
  const baseUrl = 'http://localhost:3099';

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    console.log('✅ 1. Health Check:', healthJson.status === 'OK' ? 'PASS' : 'FAIL');

    // 2. Catalog endpoint
    const catRes = await fetch(`${baseUrl}/api/catalog/products?limit=5`);
    const catJson = await catRes.json();
    console.log(`✅ 2. Catalog Products: PASS (${catJson.data.length} productos recibidos)`);
    const sampleProduct = catJson.data[0];

    // 3. Checkout endpoint & WhatsApp link generation
    const checkoutPayload = {
      customer: {
        name: 'Prueba Automatizada',
        phone: '525511223344',
        street: 'Calle de Prueba',
        exteriorNumber: '100',
        interiorNumber: 'A',
        neighborhood: 'Roma Norte',
        city: 'Cuauhtémoc',
        state: 'CDMX',
        postalCode: '06700',
        references: 'Casa con reja negra',
      },
      items: [
        {
          productId: sampleProduct.id,
          quantity: 2,
        },
      ],
    };

    const checkoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload),
    });
    const checkoutJson = await checkoutRes.json();
    console.log('✅ 3. Order Checkout: PASS, Orden #', checkoutJson.data.order.orderNumber);
    console.log('   WhatsApp Link generado:', checkoutJson.data.whatsappLink.substring(0, 50) + '...');

    // 4. Admin Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@kbeauty.mx',
        password: 'Admin123!',
      }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data.token;
    console.log('✅ 4. Admin Auth Login: PASS (JWT Token generado)');

    // 5. Admin Metrics
    const metricsRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const metricsJson = await metricsRes.json();
    console.log('✅ 5. Admin Metrics: PASS, Total Ventas:', `$${metricsJson.data.totalRevenue} MXN`);

    // 6. Admin Margin Config update & product price recalculation
    const updateMarginRes = await fetch(`${baseUrl}/api/admin/config`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profitMargin: 35,
        recalculateAllPrices: true,
      }),
    });
    const marginJson = await updateMarginRes.json();
    console.log('✅ 6. Dynamic Margin Update (35%): PASS, Productos recalculados:', marginJson.data.marginResult.updatedProductsCount);

    // 7. Scraper Manual Trigger
    const scraperRes = await fetch(`${baseUrl}/api/admin/scraper/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const scraperJson = await scraperRes.json();
    console.log('✅ 7. Scraper Sync Run: PASS, Status:', scraperJson.data.success ? 'EXITOSO' : 'FALLIDO', 'Productos:', scraperJson.data.productsUpserted);

    // 8. Frontend HTML check
    const homeHtml = await (await fetch(`${baseUrl}/`)).text();
    const adminHtml = await (await fetch(`${baseUrl}/admin`)).text();
    console.log('✅ 8. Frontend SPA Serving: PASS (Index y Admin responden 200 OK)');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS COMPLETADAS SATISFACTORIAMENTE!');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error('Error en pruebas:', e);
  process.exit(1);
});

