"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "./get-query-client";
import { GlobalLoadingIndicator } from "../../components/global-loading-indicator";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoadingIndicator />
      {children}
    </QueryClientProvider>
  );
}
