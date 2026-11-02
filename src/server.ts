import { app } from './app';
import { ENV } from './config/environment';
import { CronScheduler } from './cron/scheduler';
import prisma from './db/prisma';

async function bootstrap() {
  try {
    // 1. Probar conexión con la base de datos
    await prisma.$connect();
    console.log('[Database] Conexión establecida correctamente con SQLite/Prisma.');

    // 2. Inicializar Cron Scheduler (3:00 AM)
    CronScheduler.init();

    // 3. Levantar servidor Express
    const server = app.listen(ENV.PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🌸 K-BEAUTY STORE & ADMIN RUNNING ON PORT ${ENV.PORT}`);
      console.log(`👉 Tienda Web:      http://localhost:${ENV.PORT}`);
      console.log(`👉 Panel Admin:     http://localhost:${ENV.PORT}/admin`);
      console.log(`👉 Cron Job:        Configurado a las 3:00 AM (${ENV.CRON_SCHEDULE})`);
      console.log(`👉 Margen Activo:   ${ENV.DEFAULT_MARGIN_PERCENT}% inicial`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // Cierre controlado
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Recibida señal ${signal}. Cerrando ordenadamente...`);
      CronScheduler.stop();
      server.close(async () => {
        await prisma.$disconnect();
        console.log('[Server] Conexiones cerradas. Hasta pronto.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[Server Bootstrap Error]', error);
    process.exit(1);
  }
}

bootstrap();

