'use client';

import { useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { CommandMenu, CommandMenuTrigger } from '@/components/dashboard/command-menu';
import { Brand } from '@/components/brand';
import { OrgGate } from '@/components/dashboard/org-switcher';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="md:hidden">
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          side="left"
          className="w-[min(20rem,90vw)] gap-0 p-0 sm:p-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>Navigation</DrawerTitle>
            <DrawerDescription>
              Switch between your records and workspace settings.
            </DrawerDescription>
          </DrawerHeader>
          <Sidebar mobile onNavigate={() => setOpen(false)} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export function Shell({
  children,
  fill = false,
}: {
  children: React.ReactNode;
  /** Use the full viewport: no page width cap, and the content scrolls itself. */
  fill?: boolean;
}) {
  return (
    <CommandMenu>
      <div className={cn('flex bg-muted/40', fill ? 'h-svh' : 'min-h-svh')}>
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 md:hidden">
            <MobileNavigation />
            <Brand />
            <div className="ml-auto">
              <CommandMenuTrigger iconOnly />
            </div>
          </div>
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
    </CommandMenu>
  );
}
