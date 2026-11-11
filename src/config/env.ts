import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  APP_NAME: process.env.APP_NAME || 'BharatLocal',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'bharat_local_dev_secret_key_change_in_production_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // PostgreSQL
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bharat_local',
  PGHOST: process.env.PGHOST || 'localhost',
  PGPORT: parseInt(process.env.PGPORT || '5432', 10),
  PGUSER: process.env.PGUSER || 'postgres',
  PGPASSWORD: process.env.PGPASSWORD || 'postgres',
  PGDATABASE: process.env.PGDATABASE || 'bharat_local',
  PGSSL: process.env.PGSSL === 'true',
  ENABLE_MEMORY_DB_FALLBACK: process.env.ENABLE_MEMORY_DB_FALLBACK !== 'false',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_CACHE_TTL_SECONDS: parseInt(process.env.REDIS_CACHE_TTL_SECONDS || '300', 10),
  ENABLE_MEMORY_CACHE_FALLBACK: process.env.ENABLE_MEMORY_CACHE_FALLBACK !== 'false',

  // OTP & Notifications
  OTP_DEV_MOCK_CODE: process.env.OTP_DEV_MOCK_CODE || '123456',
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
  NOTIFICATION_WORKER_CONCURRENCY: parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '5', 10),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
};
