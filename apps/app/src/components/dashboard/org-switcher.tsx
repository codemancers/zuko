'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

function OrgBadge({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

export function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const { data: orgs } = authClient.useListOrganizations();
  const { data: active } = authClient.useActiveOrganization();

  const label = active?.name ?? 'Select organization';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label={`Organization: ${label}`}
            className={cn(
              'h-10 w-full gap-2 px-2',
              collapsed ? 'justify-center px-0' : 'justify-start',
            )}
          >
            <OrgBadge name={active?.name ?? '?'} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-left text-sm font-medium">{label}</span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Organizations
          </DropdownMenuLabel>
          {orgs?.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => authClient.organization.setActive({ organizationId: org.id })}
            >
              <OrgBadge name={org.name} />
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === active?.id && <Check aria-hidden />}
            </DropdownMenuItem>
          ))}
          {orgs?.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No organizations yet.</p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/organizations/new">
              <Plus aria-hidden />
              Create organization
            </Link>
          </DropdownMenuItem>
          {active && (
            <DropdownMenuItem asChild>
              <Link href="/org/settings/details">
                <Settings aria-hidden />
                Organization settings
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

/** Sends a signed-in user with no organizations to the create-organization page. */
export function OrgGate() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const needsOrg = !!session && !isPending && !!orgs && orgs.length === 0;

  useEffect(() => {
    if (needsOrg) router.replace('/organizations/new');
  }, [needsOrg, router]);

  return null;
}
