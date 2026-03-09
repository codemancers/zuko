'use client';

import {
  Avatar,
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarLayout,
  SidebarSection,
  SidebarSpacer,
} from '@zuko/ui-kit';
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  UserCircleIcon,
} from '@heroicons/react/16/solid';
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  Cog8ToothIcon,
  UserGroupIcon,
} from '@heroicons/react/20/solid';
import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { useEffect, useState } from 'react';
import { useChats } from '@/hooks/use-chats';
import { useQuery } from '@tanstack/react-query';
import { getOrganizations } from '@/server/query-options';

function AccountDropdownMenu({
  anchor,
}: {
  anchor: 'top start' | 'bottom end';
}) {
  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = '/sign-in';
  };

  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/settings">
        <UserCircleIcon />
        <DropdownLabel>Settings</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={handleSignOut}>
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>Sign out</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  );
}

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    image?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { data: chats = [] } = useChats();
  const recentChats = chats.slice(0, 5);

  const { data: organizations = [] } = useQuery(getOrganizations());
  const activeOrg = authClient.useActiveOrganization();

  // Pass current org to API client so backend receives X-Organization-Id (contacts, companies, deals)
  useEffect(() => {
    const id = activeOrg?.data?.id ?? null;
    apiClient.setOrganizationId(id != null ? String(id) : null);
  }, [activeOrg?.data?.id]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = await authClient.getSession();
        if (session?.data?.user) {
          setUser(session.data.user);
        } else {
          // No session, redirect to sign-in
          window.location.href = '/sign-in';
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        // On error, redirect to sign-in
        window.location.href = '/sign-in';
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Show loading state while checking session
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar
                  src={user?.image ?? undefined}
                  initials={user?.name?.[0]?.toUpperCase() || 'U'}
                  square
                />
              </DropdownButton>
              <AccountDropdownMenu anchor="bottom end" />
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Dropdown>
              <DropdownButton as={SidebarItem} className="cursor-pointer">
                <Avatar
                  src={activeOrg.data?.logo}
                  initials={activeOrg.data?.name?.[0] || 'Z'}
                />
                <SidebarLabel>
                  {activeOrg.data?.name || 'Select Organization'}
                </SidebarLabel>
                <ChevronDownIcon />
              </DropdownButton>
              <DropdownMenu
                className="min-w-80 lg:min-w-64"
                anchor="bottom start"
              >
                <DropdownItem href="/settings" className="cursor-pointer">
                  <Cog8ToothIcon />
                  <DropdownLabel>Settings</DropdownLabel>
                </DropdownItem>
                <DropdownDivider />
                {organizations.map((org) => (
                  <DropdownItem
                    key={org.id}
                    onClick={async () => {
                      await authClient.organization.setActive({
                        organizationId: org.id.toString(),
                      });
                    }}
                    className="cursor-pointer"
                  >
                    <Avatar initials={org.name[0]?.toUpperCase()} />
                    <DropdownLabel>{org.name}</DropdownLabel>
                  </DropdownItem>
                ))}
                <DropdownDivider />
                <DropdownItem
                  href="/organization/create"
                  className="cursor-pointer"
                >
                  <PlusIcon />
                  <DropdownLabel>New organization&hellip;</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/chat" current={pathname === '/chat'}>
                <ChatBubbleLeftRightIcon />
                <SidebarLabel>New chat</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/contacts"
                current={pathname.startsWith('/contacts')}
              >
                <UserGroupIcon />
                <SidebarLabel>Contacts</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/companies"
                current={pathname.startsWith('/companies')}
              >
                <BuildingOfficeIcon />
                <SidebarLabel>Companies</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/deals"
                current={pathname.startsWith('/deals')}
              >
                <BriefcaseIcon />
                <SidebarLabel>Deals</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="/settings"
                current={pathname.startsWith('/settings')}
              >
                <Cog6ToothIcon />
                <SidebarLabel>Settings</SidebarLabel>
              </SidebarItem>
            </SidebarSection>

            {recentChats.length > 0 && (
              <SidebarSection>
                <SidebarHeading>Your chats</SidebarHeading>
                {recentChats.map((chat) => (
                  <SidebarItem
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    current={pathname === `/chat/${chat.id}`}
                  >
                    <SidebarLabel>{chat.title || 'Untitled chat'}</SidebarLabel>
                  </SidebarItem>
                ))}
              </SidebarSection>
            )}

            <SidebarSpacer />
          </SidebarBody>

          <SidebarFooter className="max-lg:hidden">
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    src={user?.image ?? undefined}
                    initials={user?.name?.[0]?.toUpperCase() || 'U'}
                    className="size-10"
                    square
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                      {user?.name || 'User'}
                    </span>
                    <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                      {user?.email || 'user@example.com'}
                    </span>
                  </span>
                </span>
                <ChevronUpIcon />
              </DropdownButton>
              <AccountDropdownMenu anchor="top start" />
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
