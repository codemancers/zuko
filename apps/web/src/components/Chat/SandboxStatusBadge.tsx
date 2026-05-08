'use client';

import {
  useSandboxLifecycle,
  type SandboxLifecycleState,
} from '@/hooks/use-sandbox-lifecycle';

const STATE_LABEL: Record<SandboxLifecycleState, string> = {
  provisioning: 'Setting up workspace…',
  active: 'Workspace active',
  hibernating: 'Going to sleep…',
  hibernated: 'Workspace asleep',
  restoring: 'Waking up…',
  failed: 'Workspace failed',
};

const STATE_COLOR: Record<SandboxLifecycleState, string> = {
  provisioning: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  hibernating: 'bg-zinc-100 text-zinc-600',
  hibernated: 'bg-zinc-100 text-zinc-500',
  restoring: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-700',
};

export function SandboxStatusBadge({ sandboxId }: { sandboxId: number }) {
  const { state, error } = useSandboxLifecycle(sandboxId);
  if (!state) return null;

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATE_COLOR[state]}`}
      title={error ?? undefined}
    >
      {STATE_LABEL[state]}
    </span>
  );
}
