import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Express } from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../app';
import { migrationsFolder, type Db } from '../db/client';

/** Creates a migrated PGlite app for direct supertest use at the HTTP seam. */
export function useHttpHarness() {
  return useApp(true);
}

/** Creates an app with a closed database client for health-check coverage. */
export function useHttpHarnessWithUnreachableDatabase() {
  return useApp(false);
}

function useApp(reachable: boolean) {
  let client: PGlite | undefined;
  let db: PgliteDatabase | undefined;
  let app: Express | undefined;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle({ client });
    if (reachable) await migrate(db, { migrationsFolder });
    else await client.close();
    // Both Drizzle drivers implement the PostgreSQL query surface consumed by
    // the app; production's type remains the node-postgres driver.
    app = createApp({
      db: db as unknown as Db,
      logger: pino({ level: 'silent' }),
    });
  });

  if (reachable) {
    beforeEach(async () => {
      await db?.execute(sql`TRUNCATE TABLE devices RESTART IDENTITY CASCADE`);
    });
  }

  afterAll(async () => {
    if (reachable) await client?.close();
  });

  return {
    http() {
      if (!app) throw new Error('PGlite app used outside a test');
      return request(app);
    },
  };
}
