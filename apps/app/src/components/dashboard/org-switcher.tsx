'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, TriangleAlert, Plus, Settings } from 'lucide-react';
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
import { organizationSetupKey, useOrganizationSetup } from '@/lib/organization-setup';
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

export function OrgSwitcher({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
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
              onSelect={() => {
                if (org.id !== active?.id) {
                  void client.invalidateQueries({
                    queryKey: organizationSetupKey(org.id, session?.user.id),
                    exact: true,
                    refetchType: 'none',
                  });
                }
                void authClient.organization.setActive({ organizationId: org.id });
              }}
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
            <Link href="/organizations/new" onClick={onNavigate}>
              <Plus aria-hidden />
              Create organization
            </Link>
          </DropdownMenuItem>
          {active && (
            <DropdownMenuItem asChild>
              <Link href="/org/settings/details" onClick={onNavigate}>
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

/** Handle organization selection and report setup readiness without blocking page content. */
export function OrgGate() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const { data: active } = authClient.useActiveOrganization();
  const setup = useOrganizationSetup();
  const needsOrg = !!session && !isPending && !!orgs && orgs.length === 0;

  useEffect(() => {
    if (needsOrg) router.replace('/organizations/new');
  }, [needsOrg, router]);

  if (!session || !active || setup.isPending || setup.data?.status === 'ready') return null;
  const needsAttention = setup.isError || setup.data?.status === 'failed';
  return (
    <aside
      aria-live="polite"
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm sm:px-6',
        needsAttention
          ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
      )}
    >
      <p className="flex min-w-0 items-start gap-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {setup.isError
            ? `Could not check setup for ${active.name}.`
            : setup.data?.status === 'failed'
              ? `Setup for ${active.name} needs attention.`
              : `${active.name} is still being set up.`}
        </span>
      </p>
      <Link href="/organizations/setup" className="underline underline-offset-4">
        View setup
      </Link>
    </aside>
  );
}
