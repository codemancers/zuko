'use client';

import { useSalesOverviewAccess } from '@/hooks/use-sales-overview-access';
import { authClient } from '@/lib/auth-client';
import {
  Subheading,
  Button,
  Select,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
} from '@zuko/ui-kit';
import { PageHeader, EmptyState } from '@/components/shared';

const panelClass =
  'min-w-0 rounded-lg bg-white p-6 shadow-sm ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10';

export function SalesOverview({ organizationId }: { organizationId: number }) {
  const { allowed, loading } = useSalesOverviewAccess();
  const organization = authClient.useActiveOrganization();
  if (loading || String(organization.data?.id) !== String(organizationId)) {
    return (
      <output className="text-sm text-zinc-500 dark:text-zinc-400">
        Checking organization access…
      </output>
    );
  }
  if (!allowed)
    return (
      <EmptyState
        title="Sales Overview is restricted"
        description="Only Owners and Admins of the selected organization can open this page."
      />
    );
  return (
    <div className="space-y-6" data-organization-id={organizationId}>
      <PageHeader
        title="Sales Overview"
        description="Today’s sales work and updates requiring your attention."
      />
      <p
        id="sales-overview-preview-note"
        className="text-sm text-zinc-500 dark:text-zinc-400"
      >
        Task and activity data are not connected yet. Add task and date
        selection will be enabled in their follow-on tickets.
      </p>
      {/* Approved v12 geometry: attention left, recent work right; activities below. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-labelledby="needs-attention-title" className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <Subheading id="needs-attention-title">Needs attention</Subheading>
            <Button disabled aria-describedby="sales-overview-preview-note">
              Add task
            </Button>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Today’s tasks, overdue work, and updates awaiting your attention.
          </p>
          <EmptyState title="Sales follow-ups will appear here" />
        </section>
        <section aria-labelledby="recent-work-title" className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Subheading id="recent-work-title">Recent work</Subheading>
            <div className="w-32">
              <Select
                aria-label="Recent work period"
                aria-describedby="sales-overview-preview-note"
                defaultValue="yesterday"
                disabled
              >
                <option value="yesterday">Yesterday</option>
                <option value="today">Today</option>
                <option value="date">Choose date</option>
              </Select>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Recorded sales work and completed tasks.
          </p>
          <EmptyState title="Recorded sales work will appear here" />
        </section>
      </div>
      <section
        aria-labelledby="ongoing-activities-title"
        className={panelClass}
      >
        <Subheading id="ongoing-activities-title">
          Ongoing sales activities
        </Subheading>
        <p className="mt-2 mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          Each campaign or sales effort has its own row.
        </p>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Activity / campaign</TableHeader>
              <TableHeader>Channel</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Activity count</TableHeader>
              <TableHeader>Latest update</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody />
        </Table>
        <EmptyState
          title="Campaigns and sales activities will appear here"
          description="No activity data is connected yet."
        />
      </section>
    </div>
  );
}
