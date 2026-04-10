import { renderHook, act } from '@testing-library/react';
import { useSearchParam } from '@/hooks/use-search-param';
import { useState } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.unmock('@/hooks/use-search-param');

vi.mock('nuqs', () => {
  return {
    // we mock useQueryState to behave like a standard useState for test isolation
    useQueryState: () => useState(''),
    parseAsString: {
      withDefault: vi.fn().mockReturnThis(),
      withOptions: vi.fn().mockReturnThis(),
    },
    debounce: vi.fn((val) => val),
  };
});

describe('useSearchParam hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should initialize with empty values', () => {
    const { result } = renderHook(() => useSearchParam(500));
    
    expect(result.current.inputValue).toBe('');
    expect(result.current.debouncedValue).toBe('');
  });

  it('should instantly update inputValue but wait to update debouncedValue', () => {
    const { result } = renderHook(() => useSearchParam(500));

    act(() => {
      result.current.setInputValue('hello');
    });

    // inputValue is updated INSTANTLY for the responsive UI
    expect(result.current.inputValue).toBe('hello');
    // debouncedValue lags behind by 500ms
    expect(result.current.debouncedValue).toBe('');

    // Fast-forward the timers by the debounce duration
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now it should be updated!
    expect(result.current.debouncedValue).toBe('hello');
  });

  it('should debounce multiple rapid typed inputs', () => {
    const { result } = renderHook(() => useSearchParam(500));

    // User types "h", "he", "hel", "hell", "hello" rapidly
    act(() => { result.current.setInputValue('h'); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.setInputValue('he'); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.setInputValue('hel'); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.setInputValue('hell'); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.setInputValue('hello'); });

    // The inputValue followed exactly what the user typed
    expect(result.current.inputValue).toBe('hello');
    // But debouncedValue never fired because there was no 500ms gap!
    expect(result.current.debouncedValue).toBe('');

    // Finally wait 500ms from the last keystroke
    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current.debouncedValue).toBe('hello');
  });
});
