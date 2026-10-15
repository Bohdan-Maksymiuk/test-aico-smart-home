import { z } from 'zod';

export const deviceTypeSchema = z.enum(['light', 'thermostat']);
export type DeviceType = z.infer<typeof deviceTypeSchema>;

export const lightStateSchema = z.strictObject({
  on: z.boolean(),
  brightness: z.number().int().min(0).max(100),
});
export type LightState = z.infer<typeof lightStateSchema>;

export const thermostatModeSchema = z.enum(['off', 'heat', 'cool', 'auto']);
export type ThermostatMode = z.infer<typeof thermostatModeSchema>;

/** `targetTemp` is in °C. */
export const thermostatStateSchema = z.strictObject({
  targetTemp: z.number().min(5).max(30).multipleOf(0.5),
  mode: thermostatModeSchema,
});
export type ThermostatState = z.infer<typeof thermostatStateSchema>;

export type DeviceState = LightState | ThermostatState;

const atLeastOneSetting = (patch: object) => Object.keys(patch).length > 0;
// Only once the patch is otherwise valid: `{ on: true }` sent to a
// Thermostat is an unknown field, not an empty patch.
const isOtherwiseValid = (payload: { issues: unknown[] }) =>
  payload.issues.length === 0;
const NOTHING_TO_CHANGE = {
  message: 'At least one setting must be given',
  when: isOtherwiseValid,
};

/** The State settings to change on a Light; unknown fields (incl. `type`) are rejected. */
export const lightStatePatchSchema = lightStateSchema
  .partial()
  .refine(atLeastOneSetting, NOTHING_TO_CHANGE);
export type LightStatePatch = z.infer<typeof lightStatePatchSchema>;

/** The State settings to change on a Thermostat; unknown fields (incl. `type`) are rejected. */
export const thermostatStatePatchSchema = thermostatStateSchema
  .partial()
  .refine(atLeastOneSetting, NOTHING_TO_CHANGE);
export type ThermostatStatePatch = z.infer<typeof thermostatStatePatchSchema>;

export type DeviceStatePatch = LightStatePatch | ThermostatStatePatch;

/** The partial State schema for each Device Type. */
export const STATE_PATCH_SCHEMAS = {
  light: lightStatePatchSchema,
  thermostat: thermostatStatePatchSchema,
} satisfies Record<DeviceType, z.ZodType<DeviceStatePatch>>;

export const DEFAULT_LIGHT_STATE: LightState = { on: false, brightness: 100 };
export const DEFAULT_THERMOSTAT_STATE: ThermostatState = {
  targetTemp: 21,
  mode: 'off',
};

/**
 * Device labels are trimmed, case-preserved, and at most 64 characters.
 */
const nameSchema = z
  .string()
  .trim()
  .min(1, 'Must not be empty')
  .max(64, 'Must be 64 characters or fewer');

const roomSchema = z
  .string()
  .trim()
  .max(64, 'Must be 64 characters or fewer')
  .transform((value) => (value === '' ? undefined : value));

const createDeviceFields = {
  name: nameSchema,
  room: roomSchema.optional(),
};

export const createDeviceInputSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('light'),
    ...createDeviceFields,
    state: lightStateSchema.default(DEFAULT_LIGHT_STATE),
  }),
  z.strictObject({
    type: z.literal('thermostat'),
    ...createDeviceFields,
    state: thermostatStateSchema.default(DEFAULT_THERMOSTAT_STATE),
  }),
]);
/** What a client sends to create a Device. */
export type CreateDeviceInputBody = z.input<typeof createDeviceInputSchema>;
/** A create request after validation: labels normalised, State defaulted. */
export type CreateDeviceInput = z.output<typeof createDeviceInputSchema>;

/** Room to set, or `null` (also from an empty string) to clear it. */
const clearableRoomSchema = roomSchema
  .nullable()
  .transform((value) => value ?? null);

/**
 * Device fields to change. Name cannot be cleared; Room can be cleared with
 * `null` or an empty string. State is a Type-specific partial patch.
 */
export function updateDeviceInputSchema(type: DeviceType) {
  return z
    .strictObject({
      name: nameSchema.optional(),
      room: clearableRoomSchema.optional(),
      state: STATE_PATCH_SCHEMAS[type].optional(),
    })
    .refine(atLeastOneSetting, {
      message: 'At least one field must be given',
      when: isOtherwiseValid,
    });
}
/** What a client sends to change a Device. */
export type UpdateDeviceInput = {
  name?: string;
  room?: string | null;
  state?: DeviceStatePatch;
};

const deviceFields = {
  id: z.uuid(),
  name: z.string(),
  room: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

export const deviceSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('light'),
    ...deviceFields,
    state: lightStateSchema,
  }),
  z.strictObject({
    type: z.literal('thermostat'),
    ...deviceFields,
    state: thermostatStateSchema,
  }),
]);
export type Device = z.infer<typeof deviceSchema>;
