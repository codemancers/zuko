import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '@uidotdev/usehooks';
import { toast } from 'sonner';

interface UseAutosaveFieldOptions {
  debounceMs?: number;
  onSave: (value: string) => Promise<any>;
  fieldName?: string;
}

export function useAutosaveField(
  initialValue: string | null | undefined,
  { debounceMs = 2000, onSave, fieldName = 'field' }: UseAutosaveFieldOptions
) {
  const [value, setValue] = useState(initialValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedValue = useRef(initialValue || '');
  const debouncedValue = useDebounce(value, debounceMs);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync with initialValue if it changes externally (e.g. after a re-fetch)
  useEffect(() => {
    const normalizedInitial = initialValue || '';
    if (normalizedInitial !== value && !isSaving) {
      setValue(normalizedInitial);
      lastSavedValue.current = normalizedInitial;
    }
  }, [initialValue]);

  const save = useCallback(async (val: string) => {
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
  }, []);

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
