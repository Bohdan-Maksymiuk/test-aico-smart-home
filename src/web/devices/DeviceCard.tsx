import type { Device } from '@shared/index';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { Card } from '@/ui/Card';

export function DeviceCard({
  device,
  action,
  children,
}: {
  device: Device;
  action: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <article aria-labelledby={titleId}>
      <Card className="h-full">
        <Card.Header>
          <Card.Title>
            <h2 id={titleId}>{device.name}</h2>
          </Card.Title>
          {action && <Card.Action>{action}</Card.Action>}
        </Card.Header>
        <Card.Content className="grid gap-4">
          {device.room && (
            <p className="text-muted-foreground text-sm">{device.room}</p>
          )}
          {children}
        </Card.Content>
      </Card>
    </article>
  );
}
