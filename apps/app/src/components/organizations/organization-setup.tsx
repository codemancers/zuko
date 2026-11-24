'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { organizationSetupKey } from '@/lib/organization-setup';
import Link from 'next/link';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

const steps = [
  { id: 'prepare', name: 'Prepare organization' },
  { id: 'crm', name: 'Create CRM objects', description: 'Contacts, companies, deals, and their relationships' },
  { id: 'finish', name: 'Finish setup' },
] as const;
type Progress = {
  status: 'running' | 'ready' | 'failed';
  message: string;
  step?: (typeof steps)[number]['id'];
};

/** Live progress belongs on the setup page; other pages use a cached readiness snapshot. */
export function OrganizationSetup() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: organization, isPending: organizationPending } = authClient.useActiveOrganization();
  useEffect(() => {
    if (sessionPending) return;
    if (!session) router.replace('/login?next=%2Forganizations%2Fsetup');
    else if (!organizationPending && !organization) router.replace('/organizations/new');
  }, [session, sessionPending, organization, organizationPending, router]);
  if (sessionPending || organizationPending) return <p aria-live="polite">Loading organization…</p>;
  if (!session || !organization) return <p aria-live="polite">Redirecting…</p>;
  return <SetupProgress key={organization.id} id={organization.id} name={organization.name} />;
}

function SetupProgress({ id, name }: { id: string; name: string }) {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const [progress, setProgress] = useState<Progress>({
    status: 'running',
    message: 'Connecting to setup progress…',
  });
  useEffect(() => {
    const stream = new EventSource(`/api/organizations/${id}/setup`);
    stream.onmessage = async (event) => {
      const update = JSON.parse(event.data) as Progress;
      setProgress((current) => ({ ...update, step: update.step ?? current.step }));
      if (update.status === 'ready' || update.status === 'failed') stream.close();
      const queryKey = organizationSetupKey(id, session?.user.id);
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData(queryKey, update);
    };
    stream.onerror = () => {
      setProgress((current) => {
        if (stream.readyState !== EventSource.CLOSED && !current.step) return current;
        return {
          ...current,
          status: stream.readyState === EventSource.CLOSED ? 'failed' : 'running',
          message: stream.readyState === EventSource.CLOSED
            ? 'Connection closed. Please refresh to reconnect to setup progress.'
            : 'Connection interrupted. Reconnecting to setup progress…',
        };
      });
    };
    return () => stream.close();
  }, [id, session?.user.id, client]);
  const activeIndex = steps.findIndex((step) => step.id === progress.step);
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
      <p className="text-sm text-muted-foreground">{progress.message}</p>
      {progress.status === 'ready' && (
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      )}
    </section>
  );
}
