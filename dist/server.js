"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const environment_1 = require("./config/environment");
const scheduler_1 = require("./cron/scheduler");
const prisma_1 = __importDefault(require("./db/prisma"));
async function bootstrap() {
    try {
        // 1. Probar conexión con la base de datos
        await prisma_1.default.$connect();
        console.log('[Database] Conexión establecida correctamente con SQLite/Prisma.');
        // 2. Inicializar Cron Scheduler (3:00 AM)
        scheduler_1.CronScheduler.init();
        // 3. Levantar servidor Express
        const server = app_1.app.listen(environment_1.ENV.PORT, () => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`🌸 K-BEAUTY STORE & ADMIN RUNNING ON PORT ${environment_1.ENV.PORT}`);
            console.log(`👉 Tienda Web:      http://localhost:${environment_1.ENV.PORT}`);
            console.log(`👉 Panel Admin:     http://localhost:${environment_1.ENV.PORT}/admin`);
            console.log(`👉 Cron Job:        Configurado a las 3:00 AM (${environment_1.ENV.CRON_SCHEDULE})`);
            console.log(`👉 Margen Activo:   ${environment_1.ENV.DEFAULT_MARGIN_PERCENT}% inicial`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });
        // Cierre controlado
        const shutdown = async (signal) => {
            console.log(`\n[Server] Recibida señal ${signal}. Cerrando ordenadamente...`);
            scheduler_1.CronScheduler.stop();
            server.close(async () => {
                await prisma_1.default.$disconnect();
                console.log('[Server] Conexiones cerradas. Hasta pronto.');
                process.exit(0);
            });
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
    catch (error) {
        console.error('[Server Bootstrap Error]', error);
        process.exit(1);
    }
}
bootstrap();
