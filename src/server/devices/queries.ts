import type {
  CreateDeviceInput,
  Device,
  DeviceType,
  UpdateDeviceInput,
} from '@shared/index';
import { deviceSchema } from '@shared/index';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { HttpError } from '../http-error';
import { devices } from '../db/schema';

const columns = {
  id: devices.id,
  type: devices.type,
  name: devices.name,
  room: devices.room,
  state: devices.state,
  createdAt: devices.createdAt,
  updatedAt: devices.updatedAt,
};

const validId = (id: string) => z.guid().safeParse(id).success;
const notFound = (id: string) =>
  new HttpError(404, `Device ${id} was not found.`);

export async function createDevice(
  db: Db,
  input: CreateDeviceInput,
): Promise<Device> {
  const [row] = await db.insert(devices).values(input).returning(columns);
  if (!row) throw new Error('INSERT … RETURNING returned no row');
  return toDevice(row);
}

export async function listDevices(db: Db): Promise<Device[]> {
  return (
    await db
      .select(columns)
      .from(devices)
      .orderBy(asc(devices.createdAt), asc(devices.id))
  ).map(toDevice);
}

export async function getDevice(db: Db, id: string): Promise<Device> {
  if (!validId(id)) throw notFound(id);
  const [row] = await db
    .select(columns)
    .from(devices)
    .where(eq(devices.id, id));
  if (!row) throw notFound(id);
  return toDevice(row);
}

export async function getDeviceType(db: Db, id: string): Promise<DeviceType> {
  if (!validId(id)) throw notFound(id);
  const [row] = await db
    .select({ type: devices.type })
    .from(devices)
    .where(eq(devices.id, id));
  if (!row) throw notFound(id);
  return row.type;
}

export async function updateDevice(
  db: Db,
  id: string,
  input: UpdateDeviceInput,
): Promise<Device> {
  if (!validId(id)) throw notFound(id);
  const [row] = await db
    .update(devices)
    .set({
      name: input.name,
      room: input.room,
      state: input.state
        ? sql`${devices.state} || ${JSON.stringify(input.state)}::jsonb`
        : undefined,
      updatedAt: sql`now()`,
    })
    .where(eq(devices.id, id))
    .returning(columns);
  if (!row) throw notFound(id);
  return toDevice(row);
}

export async function deleteDevice(db: Db, id: string): Promise<void> {
  if (!validId(id)) throw notFound(id);
  const deleted = await db
    .delete(devices)
    .where(eq(devices.id, id))
    .returning({ id: devices.id });
  if (deleted.length === 0) throw notFound(id);
}

function toDevice(row: typeof devices.$inferSelect): Device {
  return deviceSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
