// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceListPage } from './DeviceListPage';

const light = {
  id: '30ad8a4a-7711-4b91-b7a4-9552822a7282',
  name: 'Living room light',
  room: 'Living room',
  type: 'light',
  state: { on: true, brightness: 75 },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function setup() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <DeviceListPage />
    </QueryClientProvider>,
  );
  return { client, user };
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DeviceListPage', () => {
  it('shows a full-page error when the initial load fails and retries', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(null, 500))
      .mockResolvedValueOnce(response([light]));
    vi.stubGlobal('fetch', fetch);
    const { user } = setup();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Can't reach the server")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Device' })).toBeNull();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('heading', { name: light.name }),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retains devices and usable controls after a failed refresh, then recovers', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([light]))
      .mockResolvedValueOnce(response(null, 500))
      .mockResolvedValueOnce(response([{ ...light, name: 'Updated light' }]));
    vi.stubGlobal('fetch', fetch);
    const { client, user } = setup();

    await screen.findByRole('heading', { name: light.name });
    await client.invalidateQueries({ queryKey: ['devices'] });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("Couldn't refresh devices")).toBeTruthy();
    expect(within(alert).getByText(/state may be out of date/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: light.name })).toBeTruthy();
    expect(
      screen.getByRole('switch', { name: 'Power' }).hasAttribute('disabled'),
    ).toBe(false);
    expect(
      screen
        .getByRole('button', { name: `Edit ${light.name}` })
        .hasAttribute('disabled'),
    ).toBe(false);
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('heading', { name: 'Updated light' }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('retains a cached empty list on refresh failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response([]))
        .mockResolvedValueOnce(response(null, 500)),
    );
    const { client } = setup();
    await screen.findByText('No devices yet');
    await client.invalidateQueries({ queryKey: ['devices'] });
    expect(await screen.findByText("Couldn't refresh devices")).toBeTruthy();
    expect(screen.getByText('No devices yet')).toBeTruthy();
  });
});
