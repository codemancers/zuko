'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shell } from '@/components/dashboard/shell';
import { UserMenu } from '@/components/dashboard/user-menu';
import { OrgSettingsProvider } from '@/components/org/settings-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient, useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/org/settings/details', label: 'Details' },
  { href: '/org/settings/members', label: 'Members' },
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

  const menu = session ? (
    <UserMenu name={session.user.name} email={session.user.email} image={session.user.image} />
  ) : (
    <Skeleton className="size-8 rounded-full" />
  );

  return (
    <Shell fill menu={menu}>
      <div className="px-6 pt-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {org?.name ?? 'Organization settings'}
        </h1>
      </div>
      <nav aria-label="Organization settings" className="mt-4 flex gap-6 border-b px-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors',
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
