import { resolve } from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/** Drizzle's PostgreSQL query surface used by the production application. */
export type Db = NodePgDatabase;

export function createPool(connectionString: string): Pool {
  // Fail fast instead of hanging when the database cannot be reached.
  return new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
}

export function createDb(pool: Pool): Db {
  return drizzle({ client: pool });
}

// The bundle is emitted under `dist/server`, while migrations stay at the
// project root. Resolve from the app's working directory in both environments.
const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

/** Applies pending drizzle-kit migrations. Throws: a failure here is fatal. */
export async function migrateDatabase(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export const migrationsFolder = MIGRATIONS_FOLDER;
