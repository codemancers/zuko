'use client';

import {
  Heading,
  Button,
  Avatar,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  Link,
  Divider,
  Text,
} from '@zuko/ui-kit';
import {
  EllipsisVerticalIcon,
  ChevronLeftIcon,
} from '@heroicons/react/20/solid';
import { useQuery } from '@tanstack/react-query';
import { getOrganizations, getTeams } from '@/server/query-options';
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
    <div className="py-8">
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

      <div className="flex items-center justify-between mb-8">
        {!hideHeader && (
          <div>
            <Heading>Teams</Heading>
            <Text className="mt-1">Manage teams within {activeOrg.name}.</Text>
          </div>
        )}
        <Button
          className={hideHeader ? 'ml-auto' : ''}
          onClick={() => router.push(`/organization/${slug}/teams/new`)}
        >
          Create Team
        </Button>
      </div>

      <ul className="mt-10">
        {teams.length === 0 ? (
          <li className="py-12 text-center text-zinc-500">No teams found.</li>
        ) : (
          teams.map((team, index) => (
            <li key={team.id}>
              <Divider soft={index > 0} />
              <div className="flex items-center justify-between">
                <div className="flex gap-6 py-8">
                  <div className="shrink-0">
                    <Avatar
                      initials={team.name.charAt(0).toUpperCase()}
                      square
                      className="size-12 shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-center">
                    <div className="text-base/6 font-semibold">
                      <Link
                        href={`/organization/${slug}/teams/${team.id}`}
                        className="text-zinc-950 dark:text-white hover:text-blue-600 transition-colors"
                      >
                        {team.name}
                      </Link>
                    </div>
                    <div className="text-xs/6 text-zinc-600 dark:text-zinc-500 font-medium italic">
                      Created on {new Date(team.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Dropdown>
                    <DropdownButton plain aria-label="More options">
                      <EllipsisVerticalIcon className="size-5 text-zinc-400" />
                    </DropdownButton>
                    <DropdownMenu anchor="bottom end">
                      <DropdownItem
                        href={`/organization/${slug}/teams/${team.id}`}
                      >
                        <DropdownLabel>View Details</DropdownLabel>
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
