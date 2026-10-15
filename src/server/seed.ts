import { createDeviceInputSchema } from '@shared/index';
import { sql } from 'drizzle-orm';
import type { Db } from './db/client';
import { devices } from './db/schema';

const demoHousehold = [
  {
    type: 'light',
    name: 'Ceiling',
    room: 'Living Room',
    state: { on: true, brightness: 80 },
  },
  {
    type: 'light',
    name: 'Reading Light',
    room: 'Living Room',
    state: { on: false, brightness: 40 },
  },
  {
    type: 'light',
    name: 'Ceiling',
    room: 'Kitchen',
    state: { on: true, brightness: 100 },
  },
  {
    type: 'thermostat',
    name: 'Heating',
    room: 'Hall',
    state: { targetTemp: 21, mode: 'heat' },
  },
  {
    type: 'light',
    name: 'Spare Light',
    state: { on: false, brightness: 100 },
  },
].map((device) => createDeviceInputSchema.parse(device));

export async function seedDemoHousehold(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialize startup checks and block writes until the seed commits.
    await tx.execute(sql`LOCK TABLE ${devices} IN SHARE ROW EXCLUSIVE MODE`);
    const existing = await tx.select({ id: devices.id }).from(devices).limit(1);
    if (existing.length > 0) return;

    // Failures must throw inside the callback so the transaction rolls back.
    await tx.insert(devices).values(demoHousehold);
  });
}
