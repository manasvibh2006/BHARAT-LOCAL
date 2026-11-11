import { createApp } from '../src/app';
import { NotificationWorker } from '../src/queue/worker';

// Initialize background notification worker
NotificationWorker.start();

// Initialize Express app
const app = createApp();

export default app;
