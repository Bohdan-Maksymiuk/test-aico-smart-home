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

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

const device = {
  id: '0a327d3e-bd77-4b49-9cb8-faa5b1389029',
  type: 'light',
  name: 'Desk lamp',
  room: 'Office',
  state: { on: false, brightness: 100 },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function setup(devices = [device]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(devices));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <DeviceListPage />
    </QueryClientProvider>,
  );
  return { user, fetchMock };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('device form workflows', () => {
  it('validates input and creates a device', async () => {
    const { user, fetchMock } = setup([]);
    await user.click(await screen.findByRole('button', { name: 'Add Device' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Device' });
    const name = within(dialog).getByLabelText(/Device Name/);
    const add = within(dialog).getByRole('button', { name: 'Add' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    await user.type(name, ' ');
    expect(within(dialog).getByText('Must not be empty')).toBeTruthy();
    expect((add as HTMLButtonElement).disabled).toBe(true);
    await user.clear(name);
    await user.type(name, 'Hall thermostat');
    await user.click(within(dialog).getByLabelText('Thermostat'));
    await user.type(within(dialog).getByLabelText('Room'), 'Hall');
    const created = {
      ...device,
      type: 'thermostat',
      name: 'Hall thermostat',
      room: 'Hall',
      state: { targetTemp: 21, mode: 'off' },
    };
    fetchMock
      .mockResolvedValueOnce(Response.json(created))
      .mockResolvedValueOnce(Response.json([created]));
    await user.click(add);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/devices',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'thermostat',
          name: 'Hall thermostat',
          room: 'Hall',
        }),
      }),
    );
    expect(await screen.findByText('Hall thermostat')).toBeTruthy();
  });

  it('edits existing values and shows server field rejection without closing', async () => {
    const { user, fetchMock } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Desk lamp' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit Device' });
    const name = within(dialog).getByLabelText<HTMLInputElement>(/Device Name/);
    expect(name.value).toBe('Desk lamp');
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', {
        name: 'Save',
      }).disabled,
    ).toBe(true);
    await user.clear(name);
    await user.type(name, 'Reading lamp');
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          type: 'about:blank',
          title: 'Invalid input',
          status: 422,
          issues: [{ path: 'name', message: 'Name already used' }],
        },
        { status: 422 },
      ),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Name already used')).toBeTruthy();
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/devices/${device.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Reading lamp', room: 'Office' }),
      }),
    );
    await user.clear(name);
    await user.type(name, 'Bedside lamp');
    const updated = { ...device, name: 'Bedside lamp' };
    fetchMock
      .mockResolvedValueOnce(Response.json(updated))
      .mockResolvedValueOnce(Response.json([updated]));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByText('Bedside lamp')).toBeTruthy();
  });

  it('keeps deletion open on failure and disables confirmation while pending', async () => {
    const { user, fetchMock } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Delete Desk lamp' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete Device?' });
    expect(within(dialog).getByText(/Desk lamp will be removed/)).toBeTruthy();
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    const deleteButton = within(dialog).getByRole('button', { name: 'Delete' });
    await user.click(deleteButton);
    await waitFor(() => {
      expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
    });
    finish(new Response(null, { status: 500 }));
    await waitFor(() => {
      expect((deleteButton as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByRole('dialog', { name: 'Delete Device?' })).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't delete the Device",
      expect.anything(),
    );
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json([]));
    await user.click(deleteButton);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/devices/${device.id}`, {
      method: 'DELETE',
    });
    expect(await screen.findByText('No devices yet')).toBeTruthy();
  });
});
