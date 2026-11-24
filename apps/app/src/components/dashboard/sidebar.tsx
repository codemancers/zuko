'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { objectListQuery } from '@/lib/queries';
import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import {
  Building2,
  Calendar,
  CheckSquare,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  MessagesSquare,
  Radio,
  Sparkles,
  UserRound,
  UserSearch,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { CommandMenuTrigger } from '@/components/dashboard/command-menu';
import { Brand } from '@/components/brand';
import { OrgSwitcher } from '@/components/dashboard/org-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OBJECTS_CHANGED } from '@/lib/objects-events';
import { getObjectIcon } from '@/components/records/object-icons';
import { cn } from '@/lib/utils';

type NavItem = { label: string; icon: LucideIcon; href?: string };
type NavSection = { title?: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: 'AI',
    items: [
      { label: 'New chat', icon: Sparkles },
      { label: 'Your chats', icon: MessagesSquare },
      { label: 'Skills', icon: Wand2 },
    ],
  },
  {
    title: 'Prospect',
    items: [
      { label: 'People', icon: UserSearch },
      { label: 'Companies', icon: Building2 },
    ],
  },
  {
    title: 'Reach',
    items: [
      { label: 'Campaigns', icon: Megaphone },
      { label: 'Channels', icon: Radio },
      { label: 'Leads', icon: Users },
    ],
  },
  {
    title: 'Records',
    items: [
      { label: 'Contacts', icon: getObjectIcon('contact'), href: '/records/contact' },
      { label: 'Companies', icon: getObjectIcon('company'), href: '/records/company' },
      { label: 'Deals', icon: getObjectIcon('deal'), href: '/records/deal' },
    ],
  },
  {
    items: [
      { label: 'Meetings', icon: Calendar },
      { label: 'Tasks', icon: CheckSquare },
      { label: 'Profile', icon: UserRound, href: '/account/profile' },
    ],
  },
];

// Put the working record tools before the sections that are still coming soon.
sections.sort((a, b) => Number(b.title === 'Records') - Number(a.title === 'Records'));

const STORAGE_KEY = 'zuko:sidebar-collapsed';

// Destinations that are not built yet render as disabled rows with a "Soon" pill.
function SoonItem({ label, icon: Icon, collapsed }: NavItem & { collapsed: boolean }) {
  return (
    <li>
      <span
        aria-disabled="true"
        title={collapsed ? `${label} (Soon)` : undefined}
        className={cn(
          'flex h-8 cursor-not-allowed items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/50',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {collapsed ? (
          <span className="sr-only">{label} (Soon)</span>
        ) : (
          <>
            <span className="flex-1 truncate">{label}</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              Soon
            </Badge>
          </>
        )}
      </span>
    </li>
  );
}

function LinkItem({
  label,
  icon: Icon,
  href,
  collapsed,
  onNavigate,
}: NavItem & { href: string; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        className={cn(
          'flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className="flex-1 truncate">{label}</span>
        )}
      </Link>
    </li>
  );
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // Storage can be unavailable; start expanded.
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Ignore: the preference simply won't persist.
  }
  listeners.forEach((listener) => listener());
}

/** The organization's own kinds of record (the standard ones are listed already), kept up to date. */
function useCustomObjects(): NavItem[] {
  const client = useQueryClient();
  const { data } = useQuery(objectListQuery);
  useEffect(() => {
    const changed = () => {
      void client.invalidateQueries({ queryKey: objectListQuery.queryKey });
    };
    window.addEventListener(OBJECTS_CHANGED, changed);
    return () => window.removeEventListener(OBJECTS_CHANGED, changed);
  }, [client]);
  return (data?.results ?? [])
    .filter((object) => object.object_kind === 'CUSTOM')
    .map((object) => ({
      label: object.plural_label,
      icon: getObjectIcon(object.name),
      href: `/records/${object.name}`,
    }));
}

export function Sidebar({
  mobile = false,
  onNavigate,
}: { mobile?: boolean; onNavigate?: () => void } = {}) {
  const custom = useCustomObjects();
  // Server render and hydration use the expanded default, then the stored preference applies.
  const preference = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const collapsed = !mobile && preference;
  const toggle = () => writeCollapsed(!collapsed);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        'min-h-0 shrink-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none',
        mobile ? 'flex h-full w-full' : 'hidden border-r md:flex',
        !mobile && (collapsed ? 'w-14' : 'w-60'),
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center' : 'justify-between pr-2 pl-4',
        )}
      >
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
          >
            <ToggleIcon aria-hidden />
          </Button>
        ) : (
          <>
            <Brand />
            {!mobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="Collapse sidebar"
                aria-expanded
              >
                <ToggleIcon aria-hidden />
              </Button>
            )}
          </>
        )}
      </div>
      <div className="shrink-0 border-b border-sidebar-border p-3">
        <OrgSwitcher collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      {!mobile && (
        <div className="px-3 pt-3">
          <CommandMenuTrigger collapsed={collapsed} />
        </div>
      )}
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto p-3">
        {sections
          .map((section) =>
            section.title === 'Records'
              ? { ...section, items: [...section.items, ...custom] }
              : section,
          )
          .map((section, i) => (
            <div key={section.title ?? i}>
              {section.title &&
                (collapsed ? (
                  <div className="mx-2 mb-2 border-t border-sidebar-border" aria-hidden />
                ) : (
                  <h2 className="px-2 pb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    {section.title}
                  </h2>
                ))}
              <ul className="space-y-0.5">
                {section.items.map((item) =>
                  item.href ? (
                    <LinkItem
                      key={item.label}
                      {...item}
                      href={item.href}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <SoonItem key={item.label} {...item} collapsed={collapsed} />
                  ),
                )}
              </ul>
            </div>
          ))}
      </nav>
    </aside>
  );
}
