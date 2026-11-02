import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'kbeauty_jwt_super_secret_key_2026_stylevana_mexico',
  STORE_WHATSAPP_PHONE: process.env.STORE_WHATSAPP_PHONE || '524531503575',
  DEFAULT_MARGIN_PERCENT: parseFloat(process.env.DEFAULT_MARGIN_PERCENT || '30'),
  STYLEVANA_BASE_URL: process.env.STYLEVANA_BASE_URL || 'https://www.stylevana.com/es_MX',
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 3 * * *',
};

