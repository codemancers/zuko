'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { authClient, useSession } from '@/lib/auth-client';
import { createQueryClient } from '@/lib/query-client';

function QueryScope({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** A fresh cache on sign-in, sign-out, or organization changes prevents tenant data leaking across sessions. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { data: organization } = authClient.useActiveOrganization();
  const scope = JSON.stringify([session?.user.id ?? null, organization?.id ?? null]);
  return <QueryScope key={scope}>{children}</QueryScope>;
}
