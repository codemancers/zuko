'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Heading,
  Text,
  Divider,
  Button,
  Avatar,
  Badge,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '@zuko/ui-kit';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import { getOrganizations } from '@/server/query-options';

export const ListOrg = () => {
  const { data: organizations = [], isLoading } = useQuery(getOrganizations());

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Loading organizations...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="flex items-center justify-between">
        <div>
          <Heading>Your Organizations</Heading>
          <Text className="mt-1">Manage the organizations you belong to.</Text>
        </div>
        <Button href="/organization/create">Create New</Button>
      </div>

      <Divider className="my-6" />

      {organizations.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <Text className="mb-4">
            You do not belong to any organizations yet.
          </Text>
          <Button href="/organization/create">
            Create your first organization
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
          {organizations.map((org) => (
            <li
              key={org.id}
              className="group flex items-center gap-6 py-6 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
            >
              <div className="flex flex-1 items-center gap-4">
                <Avatar
                  src={org.logo}
                  initials={org.name.charAt(0).toUpperCase()}
                  square
                  className="size-10 shadow-xs"
                />
                <div className="flex flex-col">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">
                    {org.name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge color="green">Active</Badge>
                <Dropdown>
                  <DropdownButton plain>
                    <EllipsisVerticalIcon className="size-5 text-zinc-500" />
                  </DropdownButton>
                  <DropdownMenu anchor="bottom end">
                    <DropdownItem href={`/organization/${org.slug}`}>
                      <DropdownLabel>Manage</DropdownLabel>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
