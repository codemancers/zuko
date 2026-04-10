'use client';

import { useQueryState, parseAsString, debounce } from 'nuqs';
import { useState, useEffect } from 'react';
import { useDebounce } from '@uidotdev/usehooks';

export function useSearchParam(debounceMs = 500) {
  // nuqs limitUrlUpdates only debounces the URL/Server request!
  // The local react state updates immediately for responsive inputs.
  const [queryValue, setQueryValue] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({
      shallow: false,
      history: 'replace',
      limitUrlUpdates: debounce(debounceMs),
    }),
  );

  // So we MUST use a custom useDebounce to debounce the value we give to React-Query (Client-Side).
  const [inputValue, setInputValue] = useState(queryValue);
  const debouncedInputValue = useDebounce(inputValue, debounceMs);

  useEffect(() => {
    setInputValue(queryValue);
  }, [queryValue]);

  useEffect(() => {
    if (debouncedInputValue !== queryValue) {
      setQueryValue(debouncedInputValue || null);
    }
  }, [debouncedInputValue, queryValue, setQueryValue]);

  return {
    inputValue,
    setInputValue,
    debouncedValue: debouncedInputValue,
  };
}
