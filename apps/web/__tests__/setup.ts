import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class ResizeObserver {
  observe() {
    // mock
  }
  unobserve() {
    // mock
  }
  disconnect() {
    // mock
  }
}
window.ResizeObserver = ResizeObserver;

afterEach(() => {
  cleanup();
});

// Globally mock the search param hook for component tests.
// This prevents 'nuqs requires an adapter' errors, and returns a synchronous
// debouncedValue so that components instantly fetch without needing fake timers in every test.
import React from 'react';
import { vi } from 'vitest';

vi.mock('@/hooks/use-search-param', () => ({
  useSearchParam: () => {
    const [val, setVal] = React.useState('');
    return { inputValue: val, setInputValue: setVal, debouncedValue: val };
  }
}));

vi.mock('@/lib/api/metadata', () => ({
  metadataApi: {
    getCurrencies: vi.fn().mockResolvedValue([
      { code: 'USD', symbol: '$', label: 'USD ($)' },
      { code: 'EUR', symbol: '€', label: 'EUR (€)' },
      { code: 'GBP', symbol: '£', label: 'GBP (£)' },
    ]),
  },
}));
