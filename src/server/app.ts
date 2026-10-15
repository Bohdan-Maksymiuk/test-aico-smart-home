import { API_BASE_PATH } from '@shared/index';
import express, { type Express } from 'express';
import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';
import type { Db } from './db/client';
import { deviceRouter } from './devices/routes';
import { errorHandler } from './error-handler';
import { healthRouter } from './health/routes';
import { problem, sendProblem } from './problem';

export interface AppDeps {
  db: Db;
  logger: Logger;
}

export function createApp({ db, logger }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json());
  app.use('/health', healthRouter(db));
  app.use(`${API_BASE_PATH}/devices`, deviceRouter(db));

  if (process.env.NODE_ENV === 'production') {
    const webRoot = fileURLToPath(new URL('../web', import.meta.url));
    const indexFile = fileURLToPath(
      new URL('../web/index.html', import.meta.url),
    );

    app.use(express.static(webRoot));
    app.use((req, res, next) => {
      if (
        req.path === API_BASE_PATH ||
        req.path.startsWith(`${API_BASE_PATH}/`) ||
        req.path === '/health' ||
        req.path.startsWith('/health/')
      ) {
        next();
        return;
      }
      res.sendFile(indexFile);
    });
  }

  app.use((req, res) => {
    sendProblem(
      res,
      problem(404, `No route matches ${req.method} ${req.path}.`),
    );
  });

  app.use(errorHandler(logger));

  return app;
}
