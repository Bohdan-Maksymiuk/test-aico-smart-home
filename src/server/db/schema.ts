import { deviceTypeSchema, type DeviceState } from '@shared/index';
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const deviceType = pgEnum('device_type', deviceTypeSchema.enum);

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: deviceType('type').notNull(),
  name: text('name').notNull(),
  room: text('room'),
  // Shape is tied to `type` by the contract; validated before every write.
  state: jsonb('state').$type<DeviceState>().notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
