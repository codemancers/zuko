'use client';

import { useQueryState, parseAsBoolean } from 'nuqs';

const sheetParser = parseAsBoolean
  .withDefault(false)
  .withOptions({ clearOnDefault: true, history: 'replace' });

/**
 * Persists sheet open/closed state in the URL.
 * Defaults to `?sheet=true`. Pass a custom key to avoid conflicts when
 * multiple sheets exist on the same page (e.g. `useSheetState('addField')`).
 * Clears the param when closed to keep URLs clean.
 */
export function useSheetState(key = 'sheet') {
  return useQueryState(key, sheetParser);
}
