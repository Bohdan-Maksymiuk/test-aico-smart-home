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
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
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

// Queues belong to the query client so separate controls for the same device
// share ordering, while different devices can still save independently.
type PendingChange = {
  variables: StateChange;
  previous: Promise<void>;
  release: () => void;
};
type DeviceQueue = {
  confirmed: Device;
  pending: PendingChange[];
  tail: Promise<void>;
};
const queues = new WeakMap<QueryClient, Map<string, DeviceQueue>>();

export function deviceStateMutationOptions(queryClient: QueryClient) {
  let clientQueues = queues.get(queryClient);
  if (!clientQueues) {
    clientQueues = new Map();
    queues.set(queryClient, clientQueues);
  }
  const activeQueues = clientQueues;

  return {
    onMutate: (variables: StateChange) => {
      const { device, patch } = variables;
      void queryClient.cancelQueries({ queryKey: devicesQuery.queryKey });
      let queue = activeQueues.get(device.id);
      if (!queue) {
        const confirmed =
          queryClient
            .getQueryData<Device[]>(devicesQuery.queryKey)
            ?.find((cached) => cached.id === device.id) ?? device;
        queue = { confirmed, pending: [], tail: Promise.resolve() };
        activeQueues.set(device.id, queue);
      }
      const previous = queue.tail;
      let release!: () => void;
      queue.tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      const change = { variables, previous, release };
      queue.pending.push(change);
      queryClient.setQueryData<Device[]>(devicesQuery.queryKey, (devices) =>
        updateCachedState(devices, device.id, patch),
      );
      return { queue, change };
    },
    mutationFn: async (variables: StateChange) => {
      const { device, patch } = variables;
      const queue = activeQueues.get(device.id);
      const change = queue?.pending.find(
        (pending) => pending.variables === variables,
      );
      if (!change) throw new Error('Device state change was not queued');
      await change.previous;
      return requestDevice(`${API_BASE_PATH}/devices/${device.id}`, 'PATCH', {
        state: patch,
      });
    },
    onSuccess: (
      device: Device,
      _variables: StateChange,
      context: { queue: DeviceQueue; change: PendingChange },
    ) => {
      context.queue.confirmed = device;
    },
    onError: (error: Error, { device }: StateChange) => {
      if (error instanceof DeviceNotFound) {
        toast.error(`${device.name} was removed`, {
          description: 'This Device was removed, so your change was not made.',
        });
        return;
      }
      toast.error(`Couldn't update ${device.name}`, {
        description: 'Your change was undone. Please try again later.',
      });
    },
    onSettled: (
      _data: Device | undefined,
      _error: Error | null,
      { device }: StateChange,
      context: { queue: DeviceQueue; change: PendingChange } | undefined,
    ) => {
      if (!context) return;
      const { queue, change } = context;
      queue.pending = queue.pending.filter((pending) => pending !== change);
      const visible = queue.pending.reduce(
        (current, pending) =>
          ({
            ...current,
            state: { ...current.state, ...pending.variables.patch },
          }) as Device,
        queue.confirmed,
      );
      queryClient.setQueryData<Device[]>(devicesQuery.queryKey, (devices) =>
        replaceCachedDevice(devices, visible),
      );
      change.release();
      if (queue.pending.length === 0) activeQueues.delete(device.id);
      // The list is shared by all devices, so wait for every optimistic write
      // before allowing a refetch to replace it.
      if (activeQueues.size === 0) {
        void queryClient.invalidateQueries({ queryKey: devicesQuery.queryKey });
      }
    },
  };
}

export function useUpdateDeviceState() {
  const queryClient = useQueryClient();
  return useMutation(deviceStateMutationOptions(queryClient));
}
