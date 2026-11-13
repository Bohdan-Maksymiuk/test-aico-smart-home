// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
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

beforeEach(() => {
  mutate.mockClear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DeviceControls', () => {
  it('coalesces rapid brightness commits across rerenders and a power change', () => {
    const { rerender } = render(
      createElement(DeviceControls, { device: light }),
    );
    const slider = screen.getByRole('slider', { name: 'Brightness' });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(createElement(DeviceControls, { device: { ...light } }));
    fireEvent.click(screen.getByRole('switch', { name: 'Power' }));
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mutate.mock.calls.map(([change]) => change.patch)).toEqual([
      { on: true },
    ]);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mutate.mock.calls.map(([change]) => change.patch)).toEqual([
      { on: true },
      { brightness: 52 },
    ]);
    expect(mutate.mock.calls[1]?.[0].device.id).toBe(light.id);
  });

  it('sends the latest temperature after a mode change', () => {
    const { rerender } = render(
      createElement(DeviceControls, { device: thermostat }),
    );
    const slider = screen.getByRole('slider', { name: 'Target temperature' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    rerender(createElement(DeviceControls, { device: { ...thermostat } }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Mode' }), {
      target: { value: 'heat' },
    });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(mutate.mock.calls.map(([change]) => change.patch)).toEqual([
      { mode: 'heat' },
      { targetTemp: 21 },
    ]);
  });

  it('flushes a pending commit on unmount without sending it twice', () => {
    const { unmount } = render(
      createElement(DeviceControls, { device: light }),
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Brightness' }), {
      key: 'ArrowRight',
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({
      device: light,
      patch: { brightness: 51 },
    });
  });

  it('flushes a pending commit to the original device when the device changes', () => {
    const { rerender } = render(
      createElement(DeviceControls, { device: light }),
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Brightness' }), {
      key: 'ArrowRight',
    });
    rerender(
      createElement(DeviceControls, {
        device: { ...light, id: 'another-device' },
      }),
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({
      device: light,
      patch: { brightness: 51 },
    });
  });
});
