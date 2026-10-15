import type { Device } from '@shared/index';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { DeviceCard } from './DeviceCard';
import { DeviceControls } from './DeviceControls';
import { DeleteDeviceDialog } from './DeleteDeviceDialog';
import { DeviceFormDialog } from './DeviceFormDialog';
import { devicesQuery } from './devices-query';

export function DeviceListPage() {
  const query = useQuery(devicesQuery);

  const [editedDevice, setEditedDevice] = useState<Device | null>(null);
  const [deletedDevice, setDeletedDevice] = useState<Device | null>(null);
  const [isAddingDialogOpen, setIsAddingDialogOpen] = useState(false);

  if (query.isPending) return <p role="status">Loading…</p>;

  if (query.isError) {
        return (
      <Alert variant="destructive">
        <Alert.Title>Can't reach the server</Alert.Title>
        <Alert.Description>
          <p>
            Your devices couldn't be loaded. Check your connection and try
            again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </Alert.Description>
      </Alert>
    );
  }

  const devices = [...query.data].sort((a, b) =>
    (a.room ?? '').localeCompare(b.room ?? ''),
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setIsAddingDialogOpen(true);
            }}
          >
            <Plus aria-hidden />
            Add Device
          </Button>
        </div>
        {devices.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">No devices yet</h2>
            <p className="text-muted-foreground mt-2 mb-6 max-w-sm">
              Add your first Light or Thermostat to see and control it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                action={
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${device.name}`}
                      onClick={() => {
                        setEditedDevice(device);
                      }}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${device.name}`}
                      onClick={() => {
                        setDeletedDevice(device);
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                }
              >
                <DeviceControls device={device} />
              </DeviceCard>
            ))}
          </div>
        )}
      </div>
      <DeviceFormDialog open={isAddingDialogOpen} onOpenChange={setIsAddingDialogOpen} />
      {editedDevice && (
        <DeviceFormDialog
          device={editedDevice}
          open
          onOpenChange={(open) => {
            if (!open) setEditedDevice(null);
          }}
        />
      )}
      {deletedDevice && (
        <DeleteDeviceDialog
          device={deletedDevice}
          open
          onOpenChange={(open) => {
            if (!open) setDeletedDevice(null);
          }}
        />
      )}
    </>
  );
}
