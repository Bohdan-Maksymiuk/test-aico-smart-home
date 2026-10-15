import { useId } from 'react';
import { Input } from '@/ui/Input';
import { Label } from '@/ui/Label';

export function TextField({
  label,
  value,
  error,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  error: string | undefined;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required && (
          <>
            <span aria-hidden className="text-destructive">
              {' *'}
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </Label>
      <Input
        id={id}
        value={value}
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {error !== undefined && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
