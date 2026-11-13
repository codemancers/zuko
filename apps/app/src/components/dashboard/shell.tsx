'use client';

import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { OrgGate } from '@/components/dashboard/org-switcher';
import { Sidebar } from '@/components/dashboard/sidebar';
import { cn } from '@/lib/utils';

export function Shell({
  children,
  menu,
  fill = false,
}: {
  children: React.ReactNode;
  menu: React.ReactNode;
  /** Use the full viewport: no page width cap, and the content scrolls itself. */
  fill?: boolean;
}) {
  return (
    <div className={cn('flex bg-muted/40', fill ? 'h-svh' : 'min-h-svh')}>
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4">
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {menu}
          </div>
        </header>
        <main
          className={cn(
            'w-full',
            fill
              ? 'flex min-h-0 flex-1 flex-col bg-background'
              : 'mx-auto max-w-5xl space-y-6 px-4 py-8',
          )}
        >
          {children}
        </main>
        <OrgGate />
      </div>
    </div>
  );
}
