'use client';

import { useEffect, useState } from 'react';

export type SandboxLifecycleState =
  | 'provisioning'
  | 'active'
  | 'hibernating'
  | 'hibernated'
  | 'restoring'
  | 'failed';

export interface SandboxLifecycleSnapshot {
  state: SandboxLifecycleState | null;
  error: string | null;
}

export function useSandboxLifecycle(
  sandboxId: number | null,
): SandboxLifecycleSnapshot {
  const [state, setState] = useState<SandboxLifecycleState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sandboxId == null) {
      setState(null);
      setError(null);
      return;
    }

    const es = new EventSource(
      `/api/proxy/sandboxes/${sandboxId}/lifecycle/events`,
      { withCredentials: true },
    );

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data as string) as {
          lifecycleState?: string;
          lifecycleError?: string | null;
        };
        if (payload.lifecycleState) {
          setState(payload.lifecycleState as SandboxLifecycleState);
        }
        if ('lifecycleError' in payload) {
          setError(payload.lifecycleError ?? null);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => es.close();
  }, [sandboxId]);

  return { state, error };
}
