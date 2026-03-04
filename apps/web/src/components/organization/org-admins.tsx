'use client';

import {
  Heading,
  Avatar,
  Badge,
  Select,
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
import { getOrganizations, getMembers } from '@/server/query-options';

export const OrgAdmins = ({ slug }: { slug: string }) => {
  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    ...getMembers(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const admins = members.filter(
    (m) => m.role === 'admin' || m.role === 'owner',
  );

  const isLoading = isLoadingOrgs || (!!activeOrg && isLoadingMembers);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">Loading admins...</div>
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
    <div className="mx-auto max-w-4xl py-10 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-10">
        <Link
          href={`/organization/${slug}`}
          className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
        >
          <ChevronLeftIcon className="size-4 fill-zinc-400 dark:fill-zinc-500" />
          Back to {activeOrg.name}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <Heading>Admins</Heading>
          <Text className="mt-1">
            Manage administrators and owners of {activeOrg.name}.
          </Text>
        </div>
      </div>

      <ul className="mt-10">
        {admins.length === 0 ? (
          <li className="py-12 text-center text-zinc-500">No admins found.</li>
        ) : (
          admins.map((admin, index) => (
            <li key={admin.id}>
              <Divider soft={index > 0} />
              <div className="flex items-center justify-between">
                <div className="flex gap-6 py-8">
                  <div className="shrink-0">
                    <Avatar
                      src={admin.user.image}
                      initials={admin.user.name
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
                        href={`/organization/${slug}/members/${admin.id}`}
                        className="text-zinc-950 dark:text-white hover:text-blue-600 transition-colors"
                      >
                        {admin.user.name || admin.user.email}
                      </Link>
                    </div>
                    <div className="text-xs/6 text-zinc-500 flex items-center gap-1.5">
                      {admin.user.email}
                      <span aria-hidden="true">·</span>
                      <Badge
                        color={admin.role === 'owner' ? 'amber' : 'zinc'}
                        className="capitalize text-[10px] px-1.5 py-0"
                      >
                        {admin.role}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="max-sm:hidden w-32">
                    <Select
                      defaultValue={admin.role}
                      onChange={(e) => {
                        console.log('Update role', e.target.value);
                      }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </Select>
                  </div>
                  <Dropdown>
                    <DropdownButton plain aria-label="More options">
                      <EllipsisVerticalIcon className="size-5 text-zinc-400" />
                    </DropdownButton>
                    <DropdownMenu anchor="bottom end">
                      <DropdownItem
                        href={`/organization/${slug}/members/${admin.id}`}
                      >
                        <DropdownLabel>View Profile</DropdownLabel>
                      </DropdownItem>
                      <DropdownItem>
                        <DropdownLabel className="text-red-500">
                          Revoke Admin Access
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
