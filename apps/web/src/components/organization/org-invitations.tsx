'use client';

import {
  Heading,
  Button,
  Avatar,
  Badge,
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
import { getOrganizations, getInvitations } from '@/server/query-options';

export const OrgInvitations = ({ slug }: { slug: string }) => {
  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    ...getInvitations(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const isLoading = isLoadingOrgs || (!!activeOrg && isLoadingInvitations);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Loading invitations...
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
    <div className="mx-auto max-w-4xl py-10">
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
          <Heading>Pending Invitations</Heading>
          <Text className="mt-1">
            Manage pending member invitations for {activeOrg.name}.
          </Text>
        </div>
        <Button onClick={() => console.log('Invite member')}>
          Invite Member
        </Button>
      </div>

      <ul className="mt-10">
        {invitations.length === 0 ? (
          <li className="py-12 text-center text-zinc-500">
            No pending invitations.
          </li>
        ) : (
          invitations.map((invite, index) => (
            <li key={invite.id}>
              <Divider soft={index > 0} />
              <div className="flex items-center justify-between">
                <div className="flex gap-6 py-8">
                  <div className="shrink-0">
                    <Avatar
                      initials={invite.email.charAt(0).toUpperCase()}
                      square
                      className="size-12 shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-center">
                    <div className="text-base/6 font-semibold">
                      <div className="text-zinc-950 dark:text-white">
                        {invite.email}
                      </div>
                    </div>
                    <div className="text-xs/6 text-zinc-500 flex items-center gap-1.5">
                      Role: <span className="capitalize">{invite.role}</span>
                      <span aria-hidden="true">·</span>
                      Expires on{' '}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge color="zinc" className="max-sm:hidden">
                    Pending
                  </Badge>
                  <Button color="red" className="max-sm:hidden">
                    Revoke
                  </Button>
                  <Dropdown>
                    <DropdownButton plain aria-label="More options">
                      <EllipsisVerticalIcon className="size-5 text-zinc-400" />
                    </DropdownButton>
                    <DropdownMenu anchor="bottom end">
                      <DropdownItem onClick={() => console.log('Resend')}>
                        <DropdownLabel>Resend Invitation</DropdownLabel>
                      </DropdownItem>
                      <DropdownItem onClick={() => console.log('Revoke')}>
                        <DropdownLabel className="text-red-500">
                          Revoke Invitation
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
