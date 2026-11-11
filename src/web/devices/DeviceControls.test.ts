// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { Device, DeviceStatePatch } from '@shared/index';
import { DeviceControls } from './DeviceControls';

const mutate =
  vi.fn<(change: { device: Device; patch: DeviceStatePatch }) => void>();
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.mock('./device-mutations', () => ({
  // Like useMutation, return a new result object on each render.
  useUpdateDeviceState: () => ({ mutate }),
}));

const common = {
  id: 'b5915707-879d-4ed7-8052-e0acfe88a192',
  name: 'Device',
  room: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const light: Device = {
  ...common,
  type: 'light',
  state: { on: false, brightness: 50 },
};
const thermostat: Device = {
  ...common,
  type: 'thermostat',
  state: { targetTemp: 20, mode: 'off' },
};

afterEach(cleanup);
beforeEach(() => mutate.mockClear());

describe('DeviceControls', () => {
  it('sends each committed brightness across rerenders and a power change', () => {
    const { rerender, unmount } = render(
      createElement(DeviceControls, { device: light }),
    );
    const slider = screen.getByRole('slider', { name: 'Brightness' });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    rerender(createElement(DeviceControls, { device: { ...light } }));
    fireEvent.click(screen.getByRole('switch', { name: 'Power' }));
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    unmount();

    expect(mutate.mock.calls.map(([change]) => change.patch)).toEqual([
      { brightness: 51 },
      { on: true },
      { brightness: 52 },
    ]);
    expect(
      mutate.mock.calls.every(([change]) => change.device.id === light.id),
    ).toBe(true);
  });

  it('sends a committed temperature even when the mode changes immediately afterwards', () => {
    const { rerender } = render(
      createElement(DeviceControls, { device: thermostat }),
    );
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'Target temperature' }),
      {
        key: 'ArrowRight',
      },
    );
    rerender(createElement(DeviceControls, { device: { ...thermostat } }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Mode' }), {
      target: { value: 'heat' },
    });

    expect(mutate.mock.calls.map(([change]) => change.patch)).toEqual([
      { targetTemp: 20.5 },
      { mode: 'heat' },
    ]);
  });
});
