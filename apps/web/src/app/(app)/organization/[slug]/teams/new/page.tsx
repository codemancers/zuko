'use client';

import { useQuery } from '@tanstack/react-query';
import { getOrganizations } from '@/server/query-options';
import { CreateTeam } from '@/components/organization/create-team';
import { use } from 'react';

export default function NewTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const { data: organizations, isLoading } = useQuery(getOrganizations());

  const activeOrg = organizations?.find((o) => o.slug === resolvedParams.slug);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Loading organization details...
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="p-8 text-center text-red-500">
        Organization not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-10 px-4 sm:px-6 lg:px-8">
      <CreateTeam organizationId={activeOrg.id} slug={resolvedParams.slug} />
    </div>
  );
}
