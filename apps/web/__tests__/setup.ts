import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import React from 'react';

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

vi.mock('@/hooks/use-search-param', () => ({
  useSearchParam: () => {
    const [val, setVal] = React.useState('');
    return { inputValue: val, setInputValue: setVal, debouncedValue: val };
  }
}));

vi.mock('@/lib/api/metadata', () => ({
  metadataApi: {
    getCurrencies: vi.fn().mockResolvedValue([
      { code: 'USD', symbol: '$', label: 'US Dollar', name: 'US Dollar' },
      { code: 'EUR', symbol: '€', label: 'Euro', name: 'Euro' },
    ]),
    getDealPriorities: vi.fn().mockResolvedValue([
      { value: 1, label: 'Low' },
      { value: 2, label: 'Medium' },
      { value: 3, label: 'High' },
    ]),
    getDealStages: vi.fn().mockResolvedValue([
      { value: 'prospecting', label: 'Prospecting' },
      { value: 'qualification', label: 'Qualification' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'closed_won', label: 'Closed Won' },
      { value: 'closed_lost', label: 'Closed Lost' },
    ]),
    getTaskStatuses: vi.fn().mockResolvedValue([
      { value: 'todo', label: 'To Do' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'done', label: 'Done' },
    ]),
  },
}));

vi.mock('@/components/Common/Editor/Editor', () => ({
  default: ({ placeholder, holder, data }: { placeholder?: string; holder: string; data?: any }) => {
    const text = data?.blocks?.map((b: any) => b.data?.text ?? '').filter(Boolean).join('\n') ?? '';
    return React.createElement('textarea', {
      'data-testid': 'editor',
      'data-holder': holder,
      placeholder,
      defaultValue: text,
      onChange: () => undefined,
    });
  },
  ensureOutputData: (val: unknown) => {
    if (typeof val === 'string' && val.trim() !== '') {
      return { blocks: [{ type: 'paragraph', data: { text: val } }] };
    }
    if (val && typeof val === 'object' && Array.isArray((val as any).blocks)) {
      return val;
    }
    return { blocks: [] };
  },
}));
