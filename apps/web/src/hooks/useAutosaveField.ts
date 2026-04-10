import { useState, useEffect, useRef, useCallback } from 'react';
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      await onSave(val);
      lastSavedValue.current = val;
    } catch {
      toast.error('Failed to save changes');
      // Option A: Rollback
      setValue(lastSavedValue.current);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, fieldName]);

  useEffect(() => {
    if (value === lastSavedValue.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      save(value);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, debounceMs, save]);

  return {
    value,
    setValue,
    isSaving,
    lastSavedValue: lastSavedValue.current,
  };
}
