'use client';

import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  Link,
  Divider,
  Button,
  Heading,
  Text,
  Avatar,
} from '@zuko/ui-kit';
import {
  UserGroupIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  CubeIcon,
  ChevronLeftIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/20/solid';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  getOrganizations,
  getMembers,
  getTeams,
  getInvitations,
} from '@/server/query-options';

export const OrgManage = ({ slug }: { slug: string }) => {
  const router = useRouter();
  const { data: organizations, isLoading: isLoadingOrgs } =
    useQuery(getOrganizations());
  const activeOrg = organizations?.find((o) => o.slug === slug);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    ...getMembers(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    ...getTeams(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const { data: invitations = [], isLoading: isLoadingInvitations } = useQuery({
    ...getInvitations(activeOrg?.id || ''),
    enabled: !!activeOrg?.id,
  });

  const counts = {
    members: members.length,
    teams: teams.length,
    invitations: invitations.length,
    admins: members.filter((m) => m.role === 'admin' || m.role === 'owner')
      .length,
  };

  const isLoading =
    isLoadingOrgs ||
    (!!activeOrg &&
      (isLoadingMembers || isLoadingTeams || isLoadingInvitations));

  if (isLoading) {
    return (
      <div className="p-8 text-center text-zinc-500">Loading dashboard...</div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="p-8 text-center text-red-500">
        Organization not found.
      </div>
    );
  }

  const dashboardItems = [
    {
      id: 'teams',
      title: 'Teams',
      subtitle: `Active in ${activeOrg.name}`,
      description: `${counts.teams} teams found`,
      icon: CubeIcon,
      href: `/organization/${slug}/teams`,
      imgUrl:
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=400&h=300',
      status: 'Active',
    },
    {
      id: 'members',
      title: 'Members',
      subtitle: `Active in ${activeOrg.name}`,
      description: `${counts.members} members total`,
      icon: UserGroupIcon,
      href: `/organization/${slug}/members`,
      imgUrl:
        'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=400&h=300',
      status: 'Active',
    },
    {
      id: 'admins',
      title: 'Admins',
      subtitle: `Active in ${activeOrg.name}`,
      description: `${counts.admins} administrators`,
      icon: ShieldCheckIcon,
      href: `/organization/${slug}/admins`,
      imgUrl:
        'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=400&h=300',
      status: 'Active',
    },
    {
      id: 'invitations',
      title: 'Invitations',
      subtitle: `Active in ${activeOrg.name}`,
      description: `${counts.invitations} pending invitations`,
      icon: EnvelopeIcon,
      href: `/organization/${slug}/invitations`,
      imgUrl:
        'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&q=80&w=400&h=300',
      status: 'Active',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="flex items-center justify-between mb-10">
        <Link
          href="/organization"
          className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"
        >
          <ChevronLeftIcon className="size-4 fill-zinc-400 dark:fill-zinc-500" />
          Back to Organizations
        </Link>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <Heading>{activeOrg.name}</Heading>
          <Text className="mt-1">
            Manage your organization settings and members.
          </Text>
        </div>
        <Button onClick={() => router.push('/organization/new')}>
          Create New Org
        </Button>
      </div>

      <ul className="mt-10">
        {dashboardItems.map((item, index) => (
          <li key={item.id}>
            <Divider soft={index > 0} />
            <div className="flex items-center justify-between">
              <div className="flex gap-6 py-8">
                <div className="shrink-0">
                  <Avatar
                    initials={item.title.charAt(0).toUpperCase()}
                    square
                    className="size-12 shadow-sm"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-center">
                  <div className="text-base/6 font-semibold">
                    <Link
                      href={item.href}
                      className="text-zinc-950 dark:text-white hover:text-blue-600 transition-colors"
                    >
                      {item.title}
                    </Link>
                  </div>

                  <div className="text-xs/6 text-zinc-600 dark:text-zinc-500 font-medium italic">
                    {item.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Dropdown>
                  <DropdownButton plain aria-label="More options">
                    <EllipsisVerticalIcon className="size-5 text-zinc-400" />
                  </DropdownButton>
                  <DropdownMenu anchor="bottom end">
                    <DropdownItem href={item.href}>
                      <DropdownLabel>View Details</DropdownLabel>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
