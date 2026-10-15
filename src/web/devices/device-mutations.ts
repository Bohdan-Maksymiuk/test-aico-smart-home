import {
  API_BASE_PATH,
  deviceSchema,
  problemDetailsSchema,
  type CreateDeviceInputBody,
  type Device,
  type DeviceStatePatch,
  type FieldIssue,
  type UpdateDeviceInput,
} from '@shared/index';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { devicesQuery } from './devices-query';

export class DeviceRejected extends Error {
  constructor(readonly issues: FieldIssue[]) {
    super('The Device input was rejected as invalid');
    this.name = 'DeviceRejected';
  }
}

function errorDescription(error: unknown, fallback: string) {
  if (error instanceof DeviceNotFound) {
    return 'This Device no longer exists.';
  }
  if (error instanceof DeviceRejected && error.issues.length > 0) {
    return [...new Set(error.issues.map((issue) => issue.message))].join(' ');
  }
  return fallback;
}

class DeviceNotFound extends Error {
  constructor() {
    super('The Device was not found');
    this.name = 'DeviceNotFound';
  }
}

function deviceToastDescription(device: Device) {
  return `Room: ${device.room ?? 'No room'}`;
}

async function requestDevice(
  url: string,
  method: 'POST' | 'PATCH',
  body: CreateDeviceInputBody | UpdateDeviceInput,
): Promise<Device> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 422) {
    const problem = problemDetailsSchema.parse(await response.json());
    throw new DeviceRejected(problem.issues ?? []);
  }
  if (response.status === 404) throw new DeviceNotFound();
  if (!response.ok) {
    throw new Error(
      `Saving a Device failed with status ${String(response.status)}`,
    );
  }
  return deviceSchema.parse(await response.json());
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDeviceInputBody) =>
      requestDevice(`${API_BASE_PATH}/devices`, 'POST', body),
    onSuccess: (device) => {
      toast.success(`Device added: ${device.name}`, {
        description: deviceToastDescription(device),
      });
      return queryClient.invalidateQueries({ queryKey: devicesQuery.queryKey });
    },
    onError: (error) => {
      toast.error("Couldn't add the Device", {
        description: errorDescription(
          error,
          'The Device could not be added. Please try again later.',
        ),
      });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDeviceInput }) =>
      requestDevice(`${API_BASE_PATH}/devices/${id}`, 'PATCH', body),
    onSuccess: (device) => {
      toast.success(`Device saved: ${device.name}`, {
        description: deviceToastDescription(device),
      });
      return queryClient.invalidateQueries({ queryKey: devicesQuery.queryKey });
    },
    onError: (error) => {
      toast.error("Couldn't save the Device", {
        description: errorDescription(
          error,
          'The Device could not be saved. Please try again later.',
        ),
      });
    },
  });
}

async function deleteDevice(device: Device) {
  const response = await fetch(`${API_BASE_PATH}/devices/${device.id}`, {
    method: 'DELETE',
  });
  if (response.status === 404) throw new DeviceNotFound();
  if (!response.ok)
    throw new Error(
      `Deleting a Device failed with status ${String(response.status)}`,
    );
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDevice,
    onSuccess: (_, device) => {
      toast.success(`Device deleted: ${device.name}`, {
        description: deviceToastDescription(device),
      });
      return queryClient.invalidateQueries({ queryKey: devicesQuery.queryKey });
    },
    onError: (error) => {
      toast.error("Couldn't delete the Device", {
        description: errorDescription(
          error,
          'The Device could not be deleted. Please try again later.',
        ),
      });
    },
  });
}

type StateChange = { device: Device; patch: DeviceStatePatch };
type StateFields = Record<string, unknown>;

function updateCachedState(
  devices: Device[] | undefined,
  id: string,
  patch: StateFields,
) {
  return devices?.map((device) =>
    device.id === id
      ? ({ ...device, state: { ...device.state, ...patch } } as Device)
      : device,
  );
}

function replaceCachedDevice(
  devices: Device[] | undefined,
  replacement: Device,
) {
  return devices?.map((device) =>
    device.id === replacement.id ? replacement : device,
  );
}

function stateOf(devices: Device[] | undefined, id: string): StateFields {
  return devices?.find((device) => device.id === id)?.state ?? {};
}

export function useUpdateDeviceState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ device, patch }: StateChange) =>
      requestDevice(`${API_BASE_PATH}/devices/${device.id}`, 'PATCH', {
        state: patch,
      }),
    onMutate: async ({ device, patch }) => {
      await queryClient.cancelQueries({ queryKey: devicesQuery.queryKey });
      const state = stateOf(
        queryClient.getQueryData<Device[]>(devicesQuery.queryKey),
        device.id,
      );
      const previous = Object.fromEntries(
        Object.keys(patch).map((field) => [field, state[field]]),
      );
      queryClient.setQueryData<Device[]>(devicesQuery.queryKey, (devices) =>
        updateCachedState(devices, device.id, patch),
      );
      return { previous };
    },
    onSuccess: (device) => {
      queryClient.setQueryData<Device[]>(devicesQuery.queryKey, (devices) =>
        replaceCachedDevice(devices, device),
      );
    },
    onError: (error, { device, patch }, context) => {
      queryClient.setQueryData<Device[]>(devicesQuery.queryKey, (devices) => {
        const state = stateOf(devices, device.id);
        const patched: StateFields = patch;
        const rollback = Object.fromEntries(
          Object.entries(context?.previous ?? {}).filter(
            ([field]) => state[field] === patched[field],
          ),
        );
        return updateCachedState(devices, device.id, rollback);
      });
      if (error instanceof DeviceNotFound) {
        toast.error(`${device.name} was removed`, {
          description: 'This Device was removed, so your change was not made.',
        });
        void queryClient.invalidateQueries({ queryKey: devicesQuery.queryKey });
        return;
      }
      toast.error(`Couldn't update ${device.name}`, {
        description: 'Your change was undone. Please try again later.',
      });
    },
  });
}
