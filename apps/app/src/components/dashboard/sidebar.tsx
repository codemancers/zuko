'use client';

import { useSyncExternalStore } from 'react';
import {
  Building2,
  Calendar,
  CheckSquare,
  Contact,
  Handshake,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  MessagesSquare,
  Radio,
  Sparkles,
  UserSearch,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { OrgSwitcher } from '@/components/dashboard/org-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavItem = { label: string; icon: LucideIcon };
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
    title: 'CRM',
    items: [
      { label: 'Contacts', icon: Contact },
      { label: 'Companies', icon: Building2 },
      { label: 'Deals', icon: Handshake },
    ],
  },
  {
    items: [
      { label: 'Meetings', icon: Calendar },
      { label: 'Tasks', icon: CheckSquare },
    ],
  },
];

const STORAGE_KEY = 'zuko:sidebar-collapsed';

// Every destination is still on the roadmap, so items render as disabled
// rows with a "Soon" pill instead of links.
function SoonItem({ label, icon: Icon, collapsed }: NavItem & { collapsed: boolean }) {
  return (
    <li>
      <span
        aria-disabled="true"
        title={collapsed ? `${label} (Soon)` : undefined}
        className={cn(
          'flex h-8 cursor-not-allowed items-center gap-2 rounded-md px-2 text-sm text-sidebar-foreground/70',
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

export function Sidebar() {
  // Server render and hydration use the expanded default, then the stored preference applies.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const toggle = () => writeCollapsed(!collapsed);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border',
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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Collapse sidebar"
              aria-expanded
            >
              <ToggleIcon aria-hidden />
            </Button>
          </>
        )}
      </div>
      <div className="border-b border-sidebar-border p-3">
        <OrgSwitcher collapsed={collapsed} />
      </div>
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto p-3">
        {sections.map((section, i) => (
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
              {section.items.map((item) => (
                <SoonItem key={item.label} {...item} collapsed={collapsed} />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
