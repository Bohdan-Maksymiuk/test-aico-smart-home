import {
  thermostatModeSchema,
  type Device,
  type DeviceStatePatch,
} from '@shared/index';
import { useEffect, useId, useRef, useState } from 'react';
import { Label } from '@/ui/Label';
import { Slider } from '@/ui/Slider';
import { Switch } from '@/ui/Switch';
import { THERMOSTAT_MODE_LABELS } from './constants';
import { useUpdateDeviceState } from './device-mutations';

function NumericSetting({
  label,
  value,
  min,
  max,
  step,
  unit,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onCommit: (value: number) => void;
}) {
  const id = useId();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    setShown(value);
  }, [value]);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <span id={id} className="text-muted-foreground">
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {shown}
          {unit}
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        value={[shown]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => {
          if (next !== undefined) setShown(next);
        }}
        onValueCommit={([next]) => {
          if (next !== undefined) onCommit(next);
        }}
      />
    </div>
  );
}

export function DeviceControls({ device }: { device: Device }) {
  const update = useUpdateDeviceState();
  const pending = useRef<{
    timer: ReturnType<typeof setTimeout>;
    send: () => void;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.send();
        pending.current = null;
      }
    };
  }, [device.id]);

  function commitNumeric(patch: DeviceStatePatch) {
    if (pending.current) clearTimeout(pending.current.timer);
    const send = () => {
      update.mutate({ device, patch });
    };
    const timer = setTimeout(() => {
      pending.current = null;
      send();
    }, 300);
    pending.current = { timer, send };
  }
  if (device.type === 'light') {
    return (
      <div className="grid gap-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <Label
            htmlFor={`${device.id}-power`}
            className="text-muted-foreground"
          >
            Power
          </Label>
          <Switch
            id={`${device.id}-power`}
            checked={device.state.on}
            onCheckedChange={(on) => {
              update.mutate({ device, patch: { on } });
            }}
          />
        </div>
        <NumericSetting
          label="Brightness"
          value={device.state.brightness}
          min={0}
          max={100}
          step={1}
          unit="%"
          onCommit={(brightness) => {
            commitNumeric({ brightness });
          }}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-4 text-sm">
      <NumericSetting
        label="Target temperature"
        value={device.state.targetTemp}
        min={5}
        max={30}
        step={0.5}
        unit=" °C"
        onCommit={(targetTemp) => {
          commitNumeric({ targetTemp });
        }}
      />
      <div className="grid gap-2">
        <Label htmlFor={`${device.id}-mode`} className="text-muted-foreground">
          Mode
        </Label>
        <select
          id={`${device.id}-mode`}
          value={device.state.mode}
          onChange={(event) => {
            update.mutate({
              device,
              patch: { mode: thermostatModeSchema.parse(event.target.value) },
            });
          }}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          {thermostatModeSchema.options.map((mode) => (
            <option key={mode} value={mode}>
              {THERMOSTAT_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
