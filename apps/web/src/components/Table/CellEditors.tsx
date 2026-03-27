'use client';

import { ReactNode } from 'react';
import { Input, Select, DateInput } from '@zuko/ui-kit';
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

export function DateEditor({ value, onChange, onBlur, autoFocus }: EditorProps) {
  return (
    <DateInput
      autoFocus={autoFocus}
      value={value as string ?? ''}
      onChange={onChange}
      onBlur={onBlur}
      className="w-full !min-w-0"
    />
  );
}

export function SelectEditor({ value, onChange, onBlur, metadata }: EditorProps) {
  const options = metadata.config?.options ?? [];
  
  return (
    <Select
      value={String(value ?? '')}
      onChange={(e) => {
        onChange(e.target.value);
        onBlur();
      }}
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
  date: DateEditor,
  currency: NumberEditor, // For now, currency uses number editor
  entity: TextEditor, // Entity names are editable as text
};

export function getEditor(type: string) {
  return EditorRegistry[type];
}
