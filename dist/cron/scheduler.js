"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const environment_1 = require("../config/environment");
const scraper_service_1 = require("../services/scraper.service");
class CronScheduler {
    static task = null;
    /**
     * Inicializa la tarea programada para las 3:00 AM
     */
    static init() {
        const schedule = environment_1.ENV.CRON_SCHEDULE; // '0 3 * * *'
        this.task = node_cron_1.default.schedule(schedule, async () => {
            const timestamp = new Date().toISOString();
            console.log(`[CRON 3:00 AM] [${timestamp}] Iniciando sincronización nocturna con Stylevana México...`);
            try {
                const result = await scraper_service_1.ScraperService.runSync('CRON_3AM');
                if (result.success) {
                    console.log(`[CRON 3:00 AM] Sincronización finalizada exitosamente. ${result.productsUpserted} productos actualizados.`);
                }
                else {
                    console.error(`[CRON 3:00 AM] Error en la sincronización: ${result.errorMessage}`);
                }
            }
            catch (err) {
                console.error('[CRON 3:00 AM] Excepción no controlada durante cron job:', err);
            }
        }, {
            scheduled: true,
            timezone: 'America/Mexico_City',
        });
        console.log(`[CronScheduler] Tarea programada registrada en "${schedule}" (Zona horaria: America/Mexico_City).`);
    }
    static stop() {
        if (this.task) {
            this.task.stop();
            console.log('[CronScheduler] Tarea programada detenida.');
        }
    }
}
exports.CronScheduler = CronScheduler;
