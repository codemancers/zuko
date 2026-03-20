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
  SidebarDivider,
  SidebarItem,
  SidebarLabel,
  SidebarLayout,
  SidebarSection,
  SidebarSpacer,
  SIDEBAR_COLLAPSED_KEY,
  SidebarNavItem,
  WithSidebarTooltip,
} from '@zuko/ui-kit';
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  UserCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/16/solid';
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
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
import { CalendarIcon } from '@heroicons/react/24/outline';

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

const navigation = [
  {
    name: 'New chat',
    href: '/chat',
    icon: ChatBubbleLeftRightIcon,
    exact: true,
  },
  { divider: true },
  { name: 'Contacts', href: '/contacts', icon: UserGroupIcon },
  { name: 'Companies', href: '/companies', icon: BuildingOfficeIcon },
  { name: 'Deals', href: '/deals', icon: BriefcaseIcon },
  { divider: true },
  { name: 'Tasks', href: '/tasks', icon: ClipboardDocumentListIcon },
  { name: 'Meetings', href: '/meetings', icon: CalendarIcon },
  { divider: true },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    image?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { data: chats = [] } = useChats();
  const recentChats = chats.slice(0, 5);

  const { data: organizations = [] } = useQuery(getOrganizations());
  const activeOrg = authClient.useActiveOrganization();

  // Load initial sidebar state
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved !== null) {
      setIsSidebarCollapsed(saved === 'true');
    }
  }, []);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

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

  const onCollapseToggle = () => setIsSidebarCollapsed(!isSidebarCollapsed);

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
      collapsed={isSidebarCollapsed}
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
        <Sidebar collapsed={isSidebarCollapsed}>
          <SidebarHeader collapsed={isSidebarCollapsed}>
            <Dropdown>
              <WithSidebarTooltip
                collapsed={isSidebarCollapsed}
                label={activeOrg.data?.name || 'Select Organization'}
              >
                <DropdownButton
                  as={SidebarItem}
                  className="cursor-pointer"
                  collapsed={isSidebarCollapsed}
                >
                  <Avatar
                    src={activeOrg.data?.logo}
                    initials={activeOrg.data?.name?.[0] || 'Z'}
                    data-slot="avatar"
                  />
                  <SidebarLabel collapsed={isSidebarCollapsed}>
                    {activeOrg.data?.name || 'Select Organization'}
                  </SidebarLabel>
                  {!isSidebarCollapsed && <ChevronDownIcon />}
                </DropdownButton>
              </WithSidebarTooltip>
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

          <SidebarBody collapsed={isSidebarCollapsed}>
            <SidebarSection collapsed={isSidebarCollapsed}>
              {navigation.map((item, index) =>
                'divider' in item ? (
                  <SidebarDivider key={`divider-${index}`} />
                ) : (
                  <SidebarNavItem
                    key={item.href}
                    href={item.href}
                    current={
                      item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
                    }
                    collapsed={isSidebarCollapsed}
                    label={item.name}
                    icon={item.icon}
                  />
                ),
              )}
            </SidebarSection>

            {recentChats.length > 0 && (
              <SidebarSection collapsed={isSidebarCollapsed}>
                <SidebarHeading collapsed={isSidebarCollapsed}>
                  Your chats
                </SidebarHeading>
                {recentChats.map((chat) => (
                  <SidebarNavItem
                    key={chat.id}
                    href={`/chat/${chat.id}`}
                    current={pathname === `/chat/${chat.id}`}
                    collapsed={isSidebarCollapsed}
                    label={chat.title || 'Untitled chat'}
                    icon={ChatBubbleLeftRightIcon}
                  />
                ))}
              </SidebarSection>
            )}

            <SidebarSpacer />
          </SidebarBody>

          <SidebarFooter
            className="max-lg:hidden"
            collapsed={isSidebarCollapsed}
          >
            <div className="mb-4 border-b border-zinc-950/5 pb-4 dark:border-white/5">
              <WithSidebarTooltip
                collapsed={isSidebarCollapsed}
                label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse'}
              >
                <SidebarItem
                  className="justify-center cursor-pointer"
                  onClick={onCollapseToggle}
                  collapsed={isSidebarCollapsed}
                >
                  {isSidebarCollapsed ? (
                    <ChevronRightIcon data-slot="icon" />
                  ) : (
                    <>
                      <ChevronLeftIcon data-slot="icon" fontSize={50} />
                      <SidebarLabel collapsed={isSidebarCollapsed}>
                        Collapse
                      </SidebarLabel>
                    </>
                  )}
                </SidebarItem>
              </WithSidebarTooltip>
            </div>

            <Dropdown>
              <WithSidebarTooltip
                collapsed={isSidebarCollapsed}
                label={user?.name || 'User'}
              >
                <DropdownButton as={SidebarItem} collapsed={isSidebarCollapsed}>
                  <Avatar
                    src={user?.image ?? undefined}
                    initials={user?.name?.[0]?.toUpperCase() || 'U'}
                    className="size-10"
                    square
                    data-slot="avatar"
                  />
                  {!isSidebarCollapsed && (
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {user?.name || 'User'}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {user?.email || 'user@example.com'}
                      </span>
                    </span>
                  )}

                  {!isSidebarCollapsed && <ChevronUpIcon />}
                </DropdownButton>
              </WithSidebarTooltip>
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
