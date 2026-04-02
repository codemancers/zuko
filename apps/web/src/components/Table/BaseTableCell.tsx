import { Cell, flexRender } from '@tanstack/react-table';
import { TableCell } from '@zuko/ui-kit';
import { useState, useRef } from 'react';
import type { ColumnMetadata, BaseRow } from './types';
import { EditorRegistry, type EditorProps } from './CellEditors';

interface BaseTableCellProps<TData> {
  cell: Cell<TData, unknown>;
  onCellUpdate?: (rowId: string | number, columnId: string, value: unknown) => void;
}

/**
 * Internal component to handle the temporary state of an active editor.
 * Isolating this state to avoid complex useEffect logic in BaseTableCell.
 */
function InlineEditor({ 
  initialValue, 
  onCommit, 
  onCancel, 
  metadata,
  Editor 
}: { 
  initialValue: unknown;
  onCommit: (val: unknown) => void;
  onCancel: () => void;
  metadata: ColumnMetadata;
  Editor: (props: EditorProps) => React.ReactNode;
}) {
  const [value, setValue] = useState<unknown>(initialValue ?? '');
  const valueRef = useRef(value);

  const handleCommit = () => onCommit(valueRef.current);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Editor
      autoFocus
      value={value}
      metadata={metadata}
      onChange={(v) => {
        setValue(v);
        valueRef.current = v;
      }}
      onBlur={handleCommit}
      onKeyDown={handleKeyDown}
    />
  );
}

export function BaseTableCell<TData extends BaseRow>({ cell, onCellUpdate }: BaseTableCellProps<TData>) {
  const [isEditing, setIsEditing] = useState(false);
  const metadata = (cell.column.columnDef as any).meta?.metadata as ColumnMetadata;
  const isEditable = metadata?.editable !== false && EditorRegistry[metadata?.fieldType];
  
  const Editor = metadata?.fieldType ? EditorRegistry[metadata.fieldType] : null;

  // Decompose value for editing
  const rawData = cell.getValue();
  const initialValue = typeof rawData === 'object' && rawData !== null && 'value' in rawData 
    ? (rawData as { value: unknown }).value 
    : rawData;

  const handleCommit = (newValue: unknown) => {
    setIsEditing(false);
    
    // Check if anything actually changed
    const isNewValueEmpty = newValue === null || newValue === undefined || (typeof newValue === 'string' && newValue.trim() === '');
    const isInitialEmpty = initialValue === null || initialValue === undefined || (typeof initialValue === 'string' && initialValue.trim() === '');

    // skip update if both are initial and new value is empty
    if (isInitialEmpty && isNewValueEmpty) return;

    if (newValue !== initialValue) {
      onCellUpdate?.(cell.row.original.id, cell.column.id, newValue);
    }
  };

  return (
    <TableCell 
      className={isEditable ? "align-middle cursor-text" : "align-middle"}
      style={{ 
        width: cell.column.id === 'sno' ? cell.column.getSize() : undefined,
        minWidth: cell.column.id === 'sno' ? cell.column.getSize() : cell.column.columnDef.minSize,
        maxWidth: cell.column.id === 'sno' ? cell.column.getSize() : cell.column.columnDef.maxSize,
      }}
      onClick={(e) => {
        if (isEditable) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
    >
      {isEditable && isEditing && Editor ? (
        <InlineEditor
          initialValue={initialValue}
          metadata={metadata}
          Editor={Editor as any}
          onCommit={handleCommit}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        flexRender(cell.column.columnDef.cell, cell.getContext())
      )}
    </TableCell>
  );
}
