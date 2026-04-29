import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { toast } from 'sonner';

interface UseAutosaveFieldOptions<T> {
  debounceMs?: number;
  onSave: (value: T) => Promise<unknown>;
  fieldName?: string;
}

export function useAutosaveField<T>(
  initialValue: T | null | undefined,
  {
    debounceMs = 2000,
    onSave,
    fieldName = 'field',
  }: UseAutosaveFieldOptions<T>,
) {
  const [value, setValue] = useState<T>(initialValue as T);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedValue = useRef<T>(initialValue as T);
  const debouncedValue = useDebounce(value, debounceMs);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync with initialValue if it changes externally (e.g. after a re-fetch)
  const prevInitialRef = useRef<string>(JSON.stringify(initialValue));
  useEffect(() => {
    const newJSON = JSON.stringify(initialValue);
    if (prevInitialRef.current !== newJSON && !isSaving) {
      prevInitialRef.current = newJSON;
      setValue(initialValue as T);
      lastSavedValue.current = initialValue as T;
    }
  }, [initialValue]);

  const save = useCallback(
    async (val: T) => {
      if (val === lastSavedValue.current) return;

      setIsSaving(true);
      try {
        await onSaveRef.current(val);
        lastSavedValue.current = val;
      } catch {
        toast.error('Failed to save changes');
        // Option A: Rollback
        setValue(lastSavedValue.current);
      } finally {
        setIsSaving(false);
      }
    },
    [fieldName],
  );

  useEffect(() => {
    if (debouncedValue !== lastSavedValue.current) {
      save(debouncedValue);
    }
  }, [debouncedValue, save]);

  return {
    value,
    setValue,
    isSaving,
    lastSavedValue: lastSavedValue.current,
  };
}
