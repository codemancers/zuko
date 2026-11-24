'use client';

import { useSheetCellEditing } from '@codemancers/sheets';

export type Option = { value: string; label: string };

/** A pick-one cell edited in place. The sheet saves it and shows saving, saved or refused on the cell. */
export function PickCell({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: Option[];
}) {
  const cell = useSheetCellEditing();
  const shown = String(cell.stagedValue ?? cell.refusedValue ?? value);
  return (
    <div className="flex h-8 items-center px-2">
      <select
        aria-label={label}
        value={shown}
        onChange={(event) => void cell.stage(event.target.value)}
        className="h-6 w-full cursor-pointer appearance-none rounded-md bg-transparent px-1 text-sm outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {(value === '' || shown === '') && <option value="">—</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
