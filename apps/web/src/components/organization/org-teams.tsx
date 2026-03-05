'use client';

import { Heading, Button, Avatar, Link, Divider, Text } from '@zuko/ui-kit';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { useQuery } from '@tanstack/react-query';
import {
  getOrganizations,
  getTeams,
  getTeamMembers,
  getMembers,
} from '@/server/query-options';
import { useRouter } from 'next/navigation';

export const OrgTeams = ({
  slug,
  hideHeader = false,
}: {
  slug: string;
  hideHeader?: boolean;
}) => {
  const router = useRouter();
  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    ...getTeams(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const isLoading = isLoadingOrgs || (!!activeOrg && isLoadingTeams);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">Loading teams...</div>
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
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-10">
          <Link
            href={`/organization/${slug}`}
            className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
          >
            <ChevronLeftIcon className="size-4 fill-zinc-400 dark:fill-zinc-500" />
            Back to {activeOrg.name}
          </Link>
        </div>
      )}

      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <Heading>Teams</Heading>
            <Text className="mt-1">Manage teams within {activeOrg.name}.</Text>
          </div>
          <Button
            onClick={() => router.push(`/organization/${slug}/teams/new`)}
          >
            Create Team
          </Button>
        </div>
      )}

      <ul className="mt-10">
        {teams.length === 0 ? (
          <li className="py-12 text-center text-zinc-500">No teams found.</li>
        ) : (
          teams.map((team, index) => (
            <li key={team.id}>
              {index > 0 && <Divider soft />}
              <div className="flex items-center justify-between">
                <div className="flex gap-6 py-8">
                  <div className="shrink-0">
                    <Avatar
                      initials={team.name.charAt(0).toUpperCase()}
                      className="size-12 shadow-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-center">
                    <div className="text-base/6 font-semibold">
                      <div className="text-zinc-950 dark:text-white transition-colors">
                        {team.name}
                      </div>
                    </div>
                    <div className="text-xs/6 text-zinc-600 dark:text-zinc-500 font-medium italic">
                      Created on {new Date(team.createdAt).toLocaleDateString()}
                    </div>
                    <TeamMemberAvatars
                      teamId={team.id}
                      organizationId={activeOrg.id}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

// Sub-component to fetch and render team member avatars
const TeamMemberAvatars = ({
  teamId,
  organizationId,
}: {
  teamId: string;
  organizationId: string;
}) => {
  const { data: teamMembers = [] } = useQuery(getTeamMembers(teamId));
  const { data: orgMembers = [] } = useQuery(getMembers(organizationId));

  const enriched = teamMembers
    .map((tm) => orgMembers.find((m) => m.user.id === tm.userId))
    .filter(Boolean) as (typeof orgMembers)[number][];

  if (enriched.length === 0) {
    return <span className="text-xs text-zinc-400 italic">No members yet</span>;
  }

  const visible = enriched.slice(0, 5);
  const overflow = enriched.length - visible.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((member) => {
          const nameToUse = member.user.name || member.user.email || '?';
          return (
            <Avatar
              key={member.id}
              src={member.user.image}
              initials={nameToUse
                .split(/[\s.@]+/)
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
              className="size-6 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 ring-2 ring-white dark:ring-zinc-900"
              title={nameToUse}
            />
          );
        })}
        {overflow > 0 && (
          <div className="size-6 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-xs text-zinc-500">
        {enriched.length} {enriched.length === 1 ? 'member' : 'members'}
      </span>
    </div>
  );
};
