import { createApp } from './app';
import { ENV } from './config/env';
import { testPostgresConnection } from './db/connection';
import { testRedisConnection } from './cache/redis';
import { NotificationWorker } from './queue/worker';

async function bootstrap() {
  console.log('------------------------------------------------------------');
  console.log(`🇮🇳 Starting Bharat Local API & Hyperlocal Community Engine`);
  console.log('------------------------------------------------------------');

  // Test database connection
  const pgConnected = await testPostgresConnection();
  if (pgConnected) {
    console.log('✅ Connected to PostgreSQL database engine');
  } else {
    console.log('ℹ️  PostgreSQL not detected on localhost:5432.');
    console.log('   Running in Resilient In-Memory Mode with full SQL schemas & sample data.');
    console.log('   (To run with PostgreSQL + Redis, use: docker-compose up)');
  }

  // Test Redis connection
  const redisConnected = await testRedisConnection();
  if (redisConnected) {
    console.log('✅ Connected to Redis Cache & Queue engine');
  } else {
    console.log('ℹ️  Redis not detected on localhost:6379.');
    console.log('   Running in High-Speed Local LRU Cache & Async Queue fallback mode.');
  }

  // Start Background Notification Worker
  NotificationWorker.start();

  const app = createApp();

  const server = app.listen(ENV.PORT, () => {
    console.log('------------------------------------------------------------');
    console.log(`🚀 Bharat Local Server is live on port: ${ENV.PORT}`);
    console.log(`🌐 Interactive Web App UI:     http://localhost:${ENV.PORT}/`);
    console.log(`📑 OpenAPI / Swagger Docs:     http://localhost:${ENV.PORT}/api/docs`);
    console.log(`⚡ System Health & Metrics:    http://localhost:${ENV.PORT}/health`);
    console.log('------------------------------------------------------------');
  });

  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down Bharat Local server...');
    server.close(() => {
      console.log('Server HTTP listener closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
