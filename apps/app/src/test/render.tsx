import { useState, type ReactNode } from 'react';
import { render as testingRender, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function TestQueries({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: Infinity } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function render(ui: ReactNode, options?: Omit<RenderOptions, 'wrapper'>) {
  return testingRender(ui, { wrapper: TestQueries, ...options });
}
