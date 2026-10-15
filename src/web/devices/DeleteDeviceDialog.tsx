import type { Device } from '@shared/index';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { useDeleteDevice } from './device-mutations';

export function DeleteDeviceDialog({
  device,
  open,
  onOpenChange,
}: {
  device: Device;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deletion = useDeleteDevice();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Delete Device?</Dialog.Title>
          <Dialog.Description>
            {device.name} will be removed from your home. This can't be undone.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Dialog.Close>
          <Button
            type="button"
            variant="destructive"
            disabled={deletion.isPending}
            onClick={() => {
              deletion.mutate(device, {
                onSuccess: () => {
                  onOpenChange(false);
                },
              });
            }}
          >
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
