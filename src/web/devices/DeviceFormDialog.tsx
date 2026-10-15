import { deviceTypeSchema, type Device } from '@shared/index';
import { useId } from 'react';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Label } from '@/ui/Label';
import { TextField } from '@/ui/TextField';
import { DEVICE_TYPE_LABELS } from './constants';
import { useDeviceForm } from './use-device-form';

export function DeviceFormDialog({
  device,
  open,
  onOpenChange,
}: {
  device?: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    values,
    errors,
    change,
    submit,
    reset,
    isPending,
    hasErrors,
    isDirty,
  } = useDeviceForm({
    device,
    onSaved: () => {
      onOpenChange(false);
    },
  });
  const typeId = useId();
  const isEditing = device !== undefined;
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>
            {isEditing ? 'Edit Device' : 'Add Device'}
          </Dialog.Title>
          <Dialog.Description>
            {isEditing
              ? 'Change its Device Name or Room.'
              : 'Add a Light or Thermostat. It starts in its default State.'}
          </Dialog.Description>
        </Dialog.Header>
        <form noValidate onSubmit={submit} className="grid gap-5">
          {!isEditing && (
            <div
              role="radiogroup"
              aria-labelledby={`${typeId}-label`}
              className="grid gap-2"
            >
              <span id={`${typeId}-label`} className="text-sm font-medium">
                Device Type
              </span>
              <div className="grid grid-cols-2 gap-2">
                {deviceTypeSchema.options.map((type) => (
                  <Label
                    key={type}
                    className="has-checked:border-primary has-checked:bg-accent cursor-pointer rounded-md border px-3 py-2.5 has-focus-visible:ring-[3px]"
                  >
                    <input
                      type="radio"
                      name="type"
                      checked={values.type === type}
                      onChange={() => {
                        change('type', type);
                      }}
                      className="accent-primary"
                    />
                    {DEVICE_TYPE_LABELS[type]}
                  </Label>
                ))}
              </div>
            </div>
          )}
          <TextField
            label="Device Name"
            value={values.name}
            error={errors.name}
            required
            onChange={(value) => {
              change('name', value);
            }}
          />
          <TextField
            label="Room"
            value={values.room}
            error={errors.room}
            onChange={(value) => {
              change('room', value);
            }}
          />
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Dialog.Close>
            <Button type="submit" disabled={isPending || !isDirty || hasErrors}>
              {isEditing ? 'Save' : 'Add'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
