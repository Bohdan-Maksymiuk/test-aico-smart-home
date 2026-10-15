import { createApp } from './app';
import { loadConfig } from './config';
import { createDb, createPool, migrateDatabase } from './db/client';
import { createLogger } from './logging';
import { seedDemoHousehold } from './seed';

const config = loadConfig(process.env);
const logger = createLogger(config.LOG_LEVEL);
const pool = createPool(config.DATABASE_URL);
const db = createDb(pool);

try {
  await migrateDatabase(db);
} catch (error) {
  logger.fatal({ err: error }, 'Database migration failed');
  await pool.end();
  process.exit(1);
}
logger.info('Database migrations applied');

try {
  await seedDemoHousehold(db);
} catch (error) {
  logger.fatal({ err: error }, 'Demo household seed failed');
  await pool.end();
  process.exit(1);
}

const app = createApp({ db, logger });

const server = app.listen(config.PORT, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'API failed to start');
    process.exit(1);
  }
  logger.info({ port: config.PORT }, 'API listening');
});

let shuttingDown = false;

/**
 * Stop accepting connections, let in-flight requests finish (idle keep-alive
 * sockets are closed right away), then close the DB pool. Requests still
 * running after the timeout are cut off so shutdown always completes.
 */
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    logger.info({ signal }, 'Already shutting down');
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const forceClose = setTimeout(() => {
    logger.warn('In-flight requests did not finish in time; closing them');
    server.closeAllConnections();
  }, config.SHUTDOWN_TIMEOUT_MS);
  forceClose.unref();

  server.close((closeError) => {
    clearTimeout(forceClose);
    pool.end().then(
      () => {
        logger.info('Shutdown complete');
        process.exitCode = closeError ? 1 : 0;
      },
      (poolError: unknown) => {
        logger.error({ err: poolError }, 'Failed to close the database pool');
        process.exitCode = 1;
      },
    );
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
