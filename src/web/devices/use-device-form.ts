import {
  createDeviceInputSchema,
  updateDeviceInputSchema,
  type CreateDeviceInputBody,
  type Device,
} from '@shared/index';
import { useState } from 'react';
import {
  DeviceRejected,
  useCreateDevice,
  useUpdateDevice,
} from './device-mutations';
import { type FieldErrors, toFieldErrors } from './field-errors';

const fields = ['type', 'name', 'room'] as const;
type Field = (typeof fields)[number];
type Values = {
  type: CreateDeviceInputBody['type'];
  name: string;
  room: string;
};

function errorsFor(values: Values, device?: Device): FieldErrors<Field> {
  const result = device
    ? updateDeviceInputSchema(device.type).safeParse({
        name: values.name,
        room: values.room,
      })
    : createDeviceInputSchema.safeParse(values);
  if (result.success) return {};
  return toFieldErrors(
    result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    })),
    fields,
  ).fields;
}

export function useDeviceForm({
  device,
  onSaved,
}: {
  device?: Device;
  onSaved: () => void;
}) {
  const [initialValues] = useState<Values>(() => ({
    type: device?.type ?? 'light',
    name: device?.name ?? '',
    room: device?.room ?? '',
  }));
  const [values, setValues] = useState<Values>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const mutation = device ? update : create;

  function reset() {
    setValues(initialValues);
    setErrors({});
    mutation.reset();
  }

  function change(field: Field, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    setErrors((current) => ({
      ...current,
      [field]: errorsFor(next, device)[field],
    }));
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = errorsFor(values, device);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const options = {
      onSuccess: () => {
        reset();
        onSaved();
      },
      onError: (error: Error) => {
        if (error instanceof DeviceRejected)
          setErrors(toFieldErrors(error.issues, fields).fields);
      },
    };
    if (device) {
      update.mutate(
        { id: device.id, body: { name: values.name, room: values.room } },
        options,
      );
    } else {
      create.mutate(values, options);
    }
  }

  return {
    values,
    errors,
    change,
    submit,
    reset,
    isPending: mutation.isPending,
    hasErrors: Boolean(Object.values(errors).filter(Boolean).length),
    isDirty:
      values.type !== initialValues.type ||
      values.name !== initialValues.name ||
      values.room !== initialValues.room,
  };
}
