import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { migrationsFolder, type Db } from './db/client';
import { devices } from './db/schema';
import { seedDemoHouseholdIfRequested } from './seed';

const env = { DATABASE_URL: 'postgres://localhost/smart_home' };

describe('demo seed on startup', () => {
  const client = new PGlite();
  const db = drizzle({ client });
  const startup = (seedDemo?: string) =>
    seedDemoHouseholdIfRequested(
      db as unknown as Db,
      loadConfig({ ...env, SEED_DEMO: seedDemo }).SEED_DEMO,
    );

  beforeAll(async () => migrate(db, { migrationsFolder }));
  afterAll(async () => client.close());

  it('seeds only when requested and preserves an empty household after restart', async () => {
    await startup();
    expect(await db.select().from(devices)).toHaveLength(0);

    await startup('true');
    const seeded = await db.select().from(devices);
    expect(seeded).toHaveLength(5);
    await startup('true');
    expect(await db.select().from(devices)).toEqual(seeded);

    await db.delete(devices);
    await startup();
    await startup('false');
    expect(await db.select().from(devices)).toHaveLength(0);
    await startup('true');
    expect(await db.select().from(devices)).toHaveLength(5);
  });

  it('rejects ambiguous opt-in values', () => {
    expect(() => loadConfig({ ...env, SEED_DEMO: 'yes' })).toThrow(
      'Invalid configuration',
    );
  });
});
