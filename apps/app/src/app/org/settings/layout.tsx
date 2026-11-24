'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Shell } from '@/components/dashboard/shell';
import { OrgSettingsProvider } from '@/components/org/settings-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/org/settings/details', label: 'Details' },
  { href: '/org/settings/members', label: 'Members' },
  { href: '/org/settings/objects', label: 'Objects' },
  { href: '/org/settings/access', label: 'Access' },
];

export default function OrgSettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const { data: org } = authClient.useActiveOrganization();
  const { data: me } = authClient.useActiveMember();

  if (!isPending && !session) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Button asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </main>
    );
  }

  return (
    <Shell fill>
      <div className="flex shrink-0 items-center gap-3 px-4 pt-6 pb-1 sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card shadow-xs">
          <Settings className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Org settings</p>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {org?.name ?? 'Organization settings'}
          </h1>
        </div>
      </div>
      <nav
        aria-label="Organization settings"
        className="mt-4 flex shrink-0 gap-6 overflow-x-auto border-b px-4 sm:px-6"
      >
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-0.5 pb-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {session && org ? (
        <OrgSettingsProvider value={{ org, userId: session.user.id, role: me?.role ?? '' }}>
          {children}
        </OrgSettingsProvider>
      ) : (
        <div className="p-6">
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </Shell>
  );
}
