'use client';

import {
  Heading,
  Divider,
  Button,
  Avatar,
  Link,
  Text,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@zuko/ui-kit';
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/20/solid';
import { useQuery } from '@tanstack/react-query';
import { getOrganizations, getMembers } from '@/server/query-options';

export const OrgMembers = ({
  slug,
  hideHeader = false,
}: {
  slug: string;
  hideHeader?: boolean;
}) => {
  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    ...getMembers(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const isLoading = isLoadingOrgs || (!!activeOrg && isLoadingMembers);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">Loading members...</div>
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
            <Heading>Members</Heading>
            <Text className="mt-1">
              Manage who has access to {activeOrg.name}.
            </Text>
          </div>
        )}
        <Button
          className={hideHeader ? 'ml-auto' : ''}
          onClick={() => console.log('Invite member')}
        >
          Invite Member
        </Button>
      </div>

      <ul className="mt-10">
        {members.length === 0 ? (
          <li className="py-12 text-center text-zinc-500">No members found.</li>
        ) : (
          members.map((member, index) => (
            <li key={member.id}>
              <Divider soft={index > 0} />
              <div className="flex items-center justify-between">
                <div className="flex gap-6 py-8">
                  <div className="shrink-0">
                    <Avatar
                      src={member.user.image}
                      initials={member.user.name
                        ?.split(' ')
                        .map((n: string) => n[0])
                        .join('')}
                      square
                      className="size-12 shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-center">
                    <div className="text-base/6 font-semibold">
                      <Link
                        href={`/organization/${slug}/members/${member.id}`}
                        className="text-zinc-950 dark:text-white hover:text-blue-600 transition-colors"
                      >
                        {member.user.name || member.user.email}
                      </Link>
                    </div>
                    <div className="text-xs/6 text-zinc-500 flex items-center gap-1.5">
                      {member.user.email}
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{member.role}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Dropdown>
                    <DropdownButton plain aria-label="More options">
                      <EllipsisVerticalIcon className="size-5 text-zinc-400" />
                    </DropdownButton>
                    <DropdownMenu anchor="bottom end">
                      <DropdownItem>
                        <DropdownLabel className="text-red-500">
                          Remove Member
                        </DropdownLabel>
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
