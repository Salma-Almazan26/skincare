import cron from 'node-cron';
import { ENV } from '../config/environment';
import { ScraperService } from '../services/scraper.service';

export class CronScheduler {
  private static task: cron.ScheduledTask | null = null;

  /**
   * Inicializa la tarea programada para las 3:00 AM
   */
  static init(): void {
    const schedule = ENV.CRON_SCHEDULE; // '0 3 * * *'

    this.task = cron.schedule(
      schedule,
      async () => {
        const timestamp = new Date().toISOString();
        console.log(`[CRON 3:00 AM] [${timestamp}] Iniciando sincronización nocturna con Stylevana México...`);

        try {
          const result = await ScraperService.runSync('CRON_3AM');
          if (result.success) {
            console.log(
              `[CRON 3:00 AM] Sincronización finalizada exitosamente. ${result.productsUpserted} productos actualizados.`
            );
          } else {
            console.error(
              `[CRON 3:00 AM] Error en la sincronización: ${result.errorMessage}`
            );
          }
        } catch (err) {
          console.error('[CRON 3:00 AM] Excepción no controlada durante cron job:', err);
        }
      },
      {
        scheduled: true,
        timezone: 'America/Mexico_City',
      }
    );

    console.log(`[CronScheduler] Tarea programada registrada en "${schedule}" (Zona horaria: America/Mexico_City).`);
  }

  static stop(): void {
    if (this.task) {
      this.task.stop();
      console.log('[CronScheduler] Tarea programada detenida.');
    }
  }
}

