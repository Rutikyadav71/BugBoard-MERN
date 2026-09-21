import { assertEnv, env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

async function start() {
  assertEnv();
  await connectDB();
  console.log('MongoDB connected');

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`BugBoard API listening on http://localhost:${env.port}/api/v1`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
