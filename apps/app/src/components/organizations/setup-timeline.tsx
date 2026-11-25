import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SetupProgress } from '@/lib/organization-setup';
import type { SetupConnection } from '@/lib/organization-setup-events';

const steps = [
  { id: 'prepare', name: 'Prepare organization' },
  { id: 'crm', name: 'Create CRM objects', description: 'Contacts, companies, deals, and their relationships' },
  { id: 'finish', name: 'Finish setup' },
] as const;

export function SetupTimeline({ name, progress, connection = 'connected' }: {
  name: string;
  progress: SetupProgress;
  connection?: SetupConnection;
}) {
  const activeIndex = steps.findIndex((step) => step.id === progress.step);
  let message = progress.message;
  if (progress.status === 'running') {
    if (connection === 'closed') message = 'Connection closed. Please refresh to reconnect to setup progress.';
    else if (connection === 'reconnecting' && progress.step) message = 'Connection interrupted. Reconnecting to setup progress…';
  }
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 p-8" aria-live="polite">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {progress.status === 'failed' ? 'Setup needs attention' : progress.status === 'ready' ? 'Setup complete' : 'Setting up your organization'}
        </p>
        <h1 className="text-2xl font-medium break-words">{name}</h1>
      </header>
      <ol aria-label="Organization setup steps" className="my-3">
        {steps.map((step, index) => {
          const complete = progress.status === 'ready' || (activeIndex >= 0 && index < activeIndex);
          const active = progress.status === 'running' && index === activeIndex;
          const failed = progress.status === 'failed' && index === activeIndex;
          const state = complete ? 'Completed' : failed ? 'Failed' : active ? 'In progress' : 'Pending';
          return (
            <li key={step.id} aria-current={active || failed ? 'step' : undefined} className="relative flex gap-3 pb-7 last:pb-0">
              {index < steps.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-3 border-l border-border" />}
              <span aria-hidden className={`relative flex size-6 shrink-0 items-center justify-center rounded border ${complete ? 'border-primary bg-primary text-primary-foreground' : failed ? 'border-destructive text-destructive' : 'border-border bg-background'}`}>
                {complete ? <Check className="size-4" /> : failed ? <X className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : null}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${!complete && !active && !failed ? 'text-muted-foreground' : ''}`}>
                  {step.name}<span className="sr-only"> — {state}</span>
                </p>
                {'description' in step && <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>}
                {failed && <p className="mt-1 text-xs text-destructive">Needs attention</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground">{message}</p>
      {progress.status === 'ready' && (
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      )}
    </section>
  );
}
