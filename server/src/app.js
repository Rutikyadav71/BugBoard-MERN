import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('dev'));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
