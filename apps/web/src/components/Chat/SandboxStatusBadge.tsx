'use client';

import { Badge } from '@zuko/ui-kit';
import {
  useSandboxLifecycle,
  type SandboxLifecycleState,
} from '@/hooks/use-sandbox-lifecycle';

type BadgeColor = 'green' | 'blue' | 'zinc' | 'red' | 'yellow';

const STATE_LABEL: Record<SandboxLifecycleState, string> = {
  provisioning: 'Setting up…',
  active: 'Workspace active',
  hibernating: 'Going to sleep…',
  hibernated: 'Workspace asleep',
  restoring: 'Waking up…',
  failed: 'Workspace failed',
};

const STATE_COLOR: Record<SandboxLifecycleState, BadgeColor> = {
  provisioning: 'yellow',
  active: 'green',
  hibernating: 'zinc',
  hibernated: 'zinc',
  restoring: 'blue',
  failed: 'red',
};

const INDICATOR_COLOR: Record<SandboxLifecycleState, string> = {
  provisioning: 'bg-yellow-400',
  active: 'bg-green-500',
  hibernating: 'bg-zinc-400',
  hibernated: 'bg-zinc-400',
  restoring: 'bg-blue-500',
  failed: 'bg-red-500',
};

const PULSING_STATES = new Set<SandboxLifecycleState>([
  'provisioning',
  'hibernating',
  'restoring',
]);

export function SandboxStatusBadge({ sandboxId }: { sandboxId: number }) {
  const { state, error } = useSandboxLifecycle(sandboxId);
  if (!state) return null;

  const pulse = PULSING_STATES.has(state);

  return (
    <Badge color={STATE_COLOR[state]} title={error ?? undefined}>
      <span className="relative flex items-center">
        <span
          className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${INDICATOR_COLOR[state]} ${pulse ? 'animate-pulse' : ''}`}
        />
      </span>
      {STATE_LABEL[state]}
    </Badge>
  );
}
