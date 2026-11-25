'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { SetupTimeline } from './setup-timeline';
import { useSetupProgress } from './use-setup-progress';

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
  return <SetupProgress key={`${session.user.id}:${organization.id}`} id={organization.id} userId={session.user.id} name={organization.name} />;
}

function SetupProgress({ id, userId, name }: { id: string; userId: string; name: string }) {
  const { progress, connection } = useSetupProgress(id, userId);
  return <SetupTimeline name={name} progress={progress} connection={connection} />;
}
