import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device, DeviceStatePatch } from '@shared/index';
import { deviceStateMutationOptions } from './device-mutations';
import { devicesQuery } from './devices-query';

const light: Device = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Light',
  room: null,
  type: 'light',
  state: { on: false, brightness: 50 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(devicesQuery.queryKey, [light]);
  const requests: { resolve: (response: Response) => void; body: string }[] =
    [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          requests.push({
            resolve,
            body: typeof init.body === 'string' ? init.body : '',
          });
        }),
    ),
  );
  const mutate = (patch: DeviceStatePatch) =>
    client
      .getMutationCache()
      .build(client, deviceStateMutationOptions(client))
      .execute({ device: light, patch });
  const state = () =>
    client.getQueryData<Device[]>(devicesQuery.queryKey)?.[0]?.state;
  return { client, requests, mutate, state };
}

function response(state: Device['state']) {
  return new Response(JSON.stringify({ ...light, state }), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('overlapping device state writes', () => {
  it('keeps newer optimistic fields visible while saving in order', async () => {
    const { requests, mutate, state, client } = setup();
    const first = mutate({ on: true });
    const second = mutate({ brightness: 80 });
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(state()).toEqual({ on: true, brightness: 80 });
    requests[0]?.resolve(response({ on: true, brightness: 50 }));
    await first;
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(state()).toEqual({ on: true, brightness: 80 });
    expect(JSON.parse(requests[1]?.body ?? '')).toEqual({
      state: { brightness: 80 },
    });
    requests[1]?.resolve(response({ on: true, brightness: 80 }));
    await second;
    expect(state()).toEqual({ on: true, brightness: 80 });
    expect(client.getQueryState(devicesQuery.queryKey)?.isInvalidated).toBe(
      true,
    );
  });

  it('rebuilds state when overlapping writes fail, including repeated values', async () => {
    const { requests, mutate, state } = setup();
    const first = mutate({ on: true }).catch(() => undefined);
    const second = mutate({ on: true }).catch(() => undefined);
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    requests[0]?.resolve(new Response(null, { status: 500 }));
    await first;
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(state()).toEqual({ on: true, brightness: 50 });
    requests[1]?.resolve(new Response(null, { status: 500 }));
    await second;
    expect(state()).toEqual({ on: false, brightness: 50 });
  });

  it('continues with a newer write after an earlier failure', async () => {
    const { requests, mutate, state } = setup();
    const first = mutate({ on: true }).catch(() => undefined);
    const second = mutate({ brightness: 80 });
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    requests[0]?.resolve(new Response(null, { status: 500 }));
    await first;
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    expect(state()).toEqual({ on: false, brightness: 80 });
    requests[1]?.resolve(response({ on: false, brightness: 80 }));
    await second;
    expect(state()).toEqual({ on: false, brightness: 80 });
  });

  it('retains a successful earlier change when a later change fails', async () => {
    const { requests, mutate, state } = setup();
    const first = mutate({ on: true });
    const second = mutate({ brightness: 80 }).catch(() => undefined);
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    requests[0]?.resolve(response({ on: true, brightness: 50 }));
    await first;
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    requests[1]?.resolve(new Response(null, { status: 500 }));
    await second;
    expect(state()).toEqual({ on: true, brightness: 50 });
  });
});
