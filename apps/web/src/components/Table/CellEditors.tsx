'use client';

import type { ReactNode } from 'react';
import { Input, InputGroup, Select, MultiSelect } from '@zuko/ui-kit';
import type { ColumnMetadata } from './types';

export interface EditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  metadata: ColumnMetadata;
  autoFocus?: boolean;
}

export function TextEditor({ value, onChange, onBlur, onKeyDown, autoFocus }: EditorProps) {
  return (
    <Input
      autoFocus={autoFocus}
      value={value as string ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="w-full !min-w-0"
    />
  );
}

export function NumberEditor({ value, onChange, onBlur, onKeyDown, autoFocus }: EditorProps) {
  return (
    <Input
      autoFocus={autoFocus}
      type="number"
      value={value as number ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="w-full !min-w-0"
    />
  );
}

export function CurrencyEditor({ value, onChange, onBlur, onKeyDown, autoFocus, metadata }: EditorProps) {
  const currency = metadata.config?.currency ?? 'USD';
  const symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? '$';

  return (
    <InputGroup className="w-full !min-w-0">
      <span
        data-slot="icon"
        className="pointer-events-none text-zinc-500 dark:text-zinc-400 text-sm font-medium select-none"
      >
        {symbol}
      </span>
      <Input
        autoFocus={autoFocus}
        type="number"
        value={value as number ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    </InputGroup>
  );
}

export function DateEditor({ value, onChange, onBlur, onKeyDown, autoFocus }: EditorProps) {
  // Format the date value to YYYY-MM-DD for the native browser date picker
  const formattedValue = (value && !isNaN(new Date(value as string).getTime()))
    ? new Date(value as string).toISOString().split('T')[0]
    : '';

  return (
    <Input
      autoFocus={autoFocus}
      type="date"
      value={formattedValue}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="w-full !min-w-0"
    />
  );
}

export function SelectEditor({ value, onChange, onBlur, onKeyDown, autoFocus, metadata }: EditorProps) {
  const options = metadata.config?.options ?? [];

  return (
    <Select
      autoFocus={autoFocus}
      value={String(value ?? '')}
      onChange={(e) => {
        onChange(e.target.value);
        onBlur();
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="!min-w-0 border-0 bg-transparent py-0 focus:ring-0"
    >
      <option value="" disabled>Select...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function MultiSelectEditor({ value, onChange, onBlur, metadata }: EditorProps) {
  const options = metadata.config?.options ?? [];
  const current = Array.isArray(value) ? (value as string[]) : [];

  return (
    <MultiSelect
      value={current}
      options={options}
      onChange={onChange as (value: string[]) => void}
      onClose={onBlur}
      colorMap={metadata.config?.colorMap}
      placeholder="Select..."
      className="w-full !min-w-0"
    />
  );
}

export function RelationEditor({ value, onChange, onBlur, onKeyDown, autoFocus, metadata }: EditorProps) {
  const options = metadata.config?.options ?? [];

  return (
    <Select
      autoFocus={autoFocus}
      value={String(value ?? '')}
      onChange={(e) => {
        onChange(e.target.value);
        onBlur();
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="!min-w-0 border-0 bg-transparent py-0 focus:ring-0"
    >
      <option value="" disabled>Select...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export const EditorRegistry: Record<string, (props: EditorProps) => ReactNode> = {
  text: TextEditor,
  number: NumberEditor,
  select: SelectEditor,
  multiselect: MultiSelectEditor,
  relation: RelationEditor,
  date: DateEditor,
  currency: CurrencyEditor,
  entity: TextEditor,
};

export function getEditor(type: string) {
  return EditorRegistry[type];
}
