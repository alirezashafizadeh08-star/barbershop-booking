import { env } from './config/env.ts';
import { createApp } from './app.ts';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
