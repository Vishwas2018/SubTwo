'use client';

import { Input } from '@/components/ui/input';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  format?: 'hh:mm:ss' | 'mm:ss';
  'aria-label'?: string;
};

/**
 * Controlled text input for time entry (hh:mm:ss or mm:ss).
 * Stores the raw string; parent converts to/from seconds.
 */
export function TimeInput({
  id,
  value,
  onChange,
  placeholder,
  format = 'hh:mm:ss',
  'aria-label': ariaLabel,
}: Props) {
  const defaultPlaceholder = format === 'mm:ss' ? 'mm:ss' : 'h:mm:ss';

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      pattern={format === 'mm:ss' ? '[0-9]+:[0-5][0-9]' : '[0-9]+:[0-5][0-9]:[0-5][0-9]'}
      placeholder={placeholder ?? defaultPlaceholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel ?? `Time in ${format} format`}
    />
  );
}
