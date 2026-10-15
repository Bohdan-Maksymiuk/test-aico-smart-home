import type { DeviceType, ThermostatMode } from '@shared/index';

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  light: 'Light',
  thermostat: 'Thermostat',
};

export const THERMOSTAT_MODE_LABELS: Record<ThermostatMode, string> = {
  off: 'Off',
  heat: 'Heat',
  cool: 'Cool',
  auto: 'Auto',
};
