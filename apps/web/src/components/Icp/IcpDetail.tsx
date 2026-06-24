'use client';

import { useState } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { OutputData } from '@editorjs/editorjs';
import {
  Avatar,
  Badge,
  Button,
  Heading,
  Sheet,
  SheetBody,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@zuko/ui-kit';
import { LinkIcon, PencilIcon } from '@heroicons/react/20/solid';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  getIcpProfile,
  getIcpCompaniesInfinite,
  getIcpContactsInfinite,
  getApolloConnectionStatus,
} from '@/server/query-options';
import { LoadingState, BackLink } from '@/components/shared';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import { useAutosaveField } from '@/hooks/useAutosaveField';
import { icpApi } from '@/lib/api/icp';
import { BaseTable } from '@/components/Table';
import type { ApolloOrganization, ApolloPerson } from '@/lib/api/icp';
import IcpForm from './IcpForm';
import dayjs from 'dayjs';

interface IcpDetailProps {
  profileId: number;
}

function formatRevenue(value?: number): string {
  if (value == null) return '—';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// ---------- Apollo error ----------

function ApolloUpgradeError({ error }: { error: unknown }) {
  const message = (error as Error)?.message ?? '';
  const isNotConnected =
    message.toLowerCase().includes('not connected') ||
    message.toLowerCase().includes('apollo is not connected');

  if (isNotConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <LinkIcon className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1">
          <Heading level={3}>Apollo is not connected</Heading>
          <Text>
            Connect your Apollo account to search companies and contacts.
          </Text>
        </div>
        <Button href="/settings?tab=integrations" color="dark">
          <LinkIcon className="size-4" />
          Connect Apollo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
      <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-red-500" />
      <Text className="text-red-700 dark:text-red-400">
        Failed to fetch data from Apollo.{message ? ` ${message}` : ''}
      </Text>
    </div>
  );
}

// ---------- Column definitions ----------

const companyColumns: ColumnDef<ApolloOrganization & { id: string }>[] = [
  {
    accessorKey: 'name',
    header: 'Company',
    cell: ({ row }) => {
      const org = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar
            src={org.logo_url}
            square
            initials={org.name?.[0]?.toUpperCase()}
            alt={`${org.name} logo`}
            className="size-7 bg-zinc-200 dark:bg-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
          />
          <div>
            <div className="font-medium text-zinc-900 dark:text-white">
              {org.website_url ? (
                <a
                  href={org.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {org.name}
                </a>
              ) : (
                org.name
              )}
            </div>
            {org.primary_domain && (
              <div className="text-xs text-zinc-400">{org.primary_domain}</div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'industry',
    header: 'Industry',
    cell: ({ getValue }) => getValue<string>() ?? '—',
  },
  {
    accessorKey: 'estimated_num_employees',
    header: 'Employees',
    cell: ({ getValue }) => getValue<number>()?.toLocaleString() ?? '—',
  },
  {
    accessorKey: 'annual_revenue',
    header: 'Revenue',
    cell: ({ getValue }) => formatRevenue(getValue<number>()),
  },
  {
    id: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const org = row.original;
      return [org.city, org.country].filter(Boolean).join(', ') || '—';
    },
  },
];

const contactColumns: ColumnDef<ApolloPerson & { id: string }>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const person = row.original;
      const initials = person.name
        ?.split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      return (
        <div className="flex items-center gap-3">
          <Avatar
            src={person.photo_url}
            initials={initials}
            alt={person.name}
            className="size-7 bg-zinc-200 dark:bg-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
          />
          <span className="font-medium text-zinc-900 dark:text-white">
            {person.name}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ getValue }) => getValue<string>() ?? '—',
  },
  {
    id: 'company',
    header: 'Company',
    cell: ({ row }) => row.original.organization?.name ?? '—',
  },
  {
    id: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const p = row.original;
      return [p.city, p.country].filter(Boolean).join(', ') || '—';
    },
  },
  {
    accessorKey: 'linkedin_url',
    header: 'LinkedIn',
    cell: ({ getValue }) => {
      const url = getValue<string>();
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          View
        </a>
      ) : (
        '—'
      );
    },
  },
];

// ---------- Tab panels ----------

type Tab = 'details' | 'companies' | 'contacts';

const TAB_VALUES = ['details', 'companies', 'contacts'] as const;
const tabParser = parseAsStringLiteral(TAB_VALUES).withDefault('details');

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'companies', label: 'Companies' },
  { id: 'contacts', label: 'Contacts' },
];

// ---------- Details Panel ----------

function DetailsPanel({ profileId }: { profileId: number }) {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(getIcpProfile(profileId));

  const updateMutation = useMutation({
    mutationFn: (notes: OutputData) =>
      icpApi.updateProfile(profileId, {
        notes: notes as unknown as Record<string, unknown>,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['icp', 'profile', profileId],
      });
    },
  });

  const notesField = useAutosaveField<OutputData>(
    ensureOutputData(profile?.notes),
    {
      fieldName: 'notes',
      onSave: (val) => updateMutation.mutateAsync(val),
    },
  );

  return (
    <div className="relative">
      {notesField.isSaving && (
        <p className="absolute right-0 -top-6 text-xs text-zinc-400">Saving…</p>
      )}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 min-h-64 shadow-sm">
        <Editor
          key={`icp-notes-${profileId}`}
          holder={`icp-notes-editor-${profileId}`}
          data={notesField.value}
          onChange={(val) => notesField.setValue(val)}
          placeholder="Write notes about this ICP profile…"
        />
      </div>
    </div>
  );
}

function CompaniesPanel({ profileId }: { profileId: number }) {
  const { data: apolloStatus } = useQuery(getApolloConnectionStatus());

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...getIcpCompaniesInfinite(profileId),
    enabled: apolloStatus?.connected === true,
  });

  const organizations = data?.pages.flatMap((p) => p.organizations) ?? [];
  const totalCount = data?.pages[0]?.pagination?.total_entries;

  if (apolloStatus?.connected === false) {
    return <ApolloUpgradeError error={new Error('Apollo is not connected')} />;
  }

  if (isError) return <ApolloUpgradeError error={error} />;

  return (
    <div className="space-y-4 [&>div]:mt-0">
      <BaseTable
        columns={companyColumns}
        data={organizations}
        loading={isLoading || apolloStatus === undefined}
        entityName="companies"
        disableRowClick
        totalCount={totalCount}
        showEmptyState={!isLoading}
        emptyStateConfig={{
          icon: () => null,
          title: 'No companies found',
          description: 'Try adjusting your ICP filters.',
          action: { label: '', onClick: () => {} },
        }}
        onFetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
      {totalCount != null && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalCount.toLocaleString()} companies found
        </p>
      )}
    </div>
  );
}

function ContactsPanel({ profileId }: { profileId: number }) {
  const { data: apolloStatus } = useQuery(getApolloConnectionStatus());

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    ...getIcpContactsInfinite(profileId),
    enabled: apolloStatus?.connected === true,
  });

  const people = data?.pages.flatMap((p) => p.people) ?? [];
  const totalCount = data?.pages[0]?.pagination?.total_entries;

  if (apolloStatus?.connected === false) {
    return <ApolloUpgradeError error={new Error('Apollo is not connected')} />;
  }

  if (isError) return <ApolloUpgradeError error={error} />;

  return (
    <div className="space-y-4 [&>div]:mt-0">
      <BaseTable
        columns={contactColumns}
        data={people}
        loading={isLoading || apolloStatus === undefined}
        entityName="contacts"
        disableRowClick
        totalCount={totalCount}
        showEmptyState={!isLoading}
        emptyStateConfig={{
          icon: () => null,
          title: 'No contacts found',
          description: 'Try adjusting your ICP filters.',
          action: { label: '', onClick: () => {} },
        }}
        onFetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />
      {totalCount != null && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalCount.toLocaleString()} contacts found
        </p>
      )}
    </div>
  );
}

// ---------- Sidebar ----------

function ProfileSidebar({
  profileId,
  onEditSuccess,
}: {
  profileId: number;
  onEditSuccess: () => void;
}) {
  const { data: profile } = useQuery(getIcpProfile(profileId));
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (!profile) return null;

  const { filters } = profile;

  return (
    <>
      <Sheet open={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <SheetHeader>
          <SheetTitle>Edit ICP Profile</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <IcpForm
            mode="edit"
            profile={profile}
            onSuccess={() => {
              setIsSheetOpen(false);
              onEditSuccess();
            }}
            onCancel={() => setIsSheetOpen(false)}
          />
        </SheetBody>
      </Sheet>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Profile Details
          </Text>
          <button
            onClick={() => setIsSheetOpen(true)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <PencilIcon className="size-3" />
            Edit
          </button>
        </div>

        {profile.description && (
          <div>
            <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Description
            </Text>
            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              <Editor
                key={`icp-desc-sidebar-${profileId}`}
                holder={`icp-desc-sidebar-editor-${profileId}`}
                data={ensureOutputData(profile.description)}
                readOnly
              />
            </div>
          </div>
        )}

        <div>
          <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Industries
          </Text>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {filters.industries?.length ? (
              filters.industries.map((ind) => (
                <Badge key={ind} color="blue">
                  {ind}
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-zinc-400">Not set</Text>
            )}
          </div>
        </div>

        <div>
          <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Employee Ranges
          </Text>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {filters.employeeRanges?.length ? (
              filters.employeeRanges.map((r) => (
                <Badge key={r} color="green">
                  {r}
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-zinc-400">Not set</Text>
            )}
          </div>
        </div>

        {filters.revenueRange && (
          <div>
            <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Revenue Range
            </Text>
            <Text className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              {formatRevenue(filters.revenueRange.min)} –{' '}
              {formatRevenue(filters.revenueRange.max)}
            </Text>
          </div>
        )}

        <div>
          <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Locations
          </Text>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {filters.locations?.length ? (
              filters.locations.map((loc) => (
                <Badge key={loc} color="orange">
                  {loc}
                </Badge>
              ))
            ) : (
              <Text className="text-sm text-zinc-400">Not set</Text>
            )}
          </div>
        </div>

        <div>
          <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Created
          </Text>
          <Text className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {dayjs(profile.createdAt).format('MMM D, YYYY')}
          </Text>
        </div>
      </div>
    </>
  );
}

// ---------- Main Component ----------

export default function IcpDetail({ profileId }: IcpDetailProps) {
  const [activeTab, setActiveTab] = useQueryState('tab', tabParser);

  const {
    data: profile,
    isLoading,
    refetch,
  } = useQuery(getIcpProfile(profileId));

  if (isLoading) return <LoadingState message="Loading ICP profile…" />;
  if (!profile)
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        Profile not found.
      </p>
    );

  return (
    <>
      <BackLink href="/icps">ICP Profiles</BackLink>

      <div className="mt-4">
        <Heading>{profile.name}</Heading>
      </div>

      <Tabs
        selectedIndex={TABS.findIndex((t) => t.id === activeTab)}
        onChange={(index: number) => setActiveTab(TABS[index].id)}
      >
        <TabsList variant="line" className="mt-6 !justify-start">
          {TABS.map(({ id, label }) => (
            <TabsTrigger key={id}>{label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6 flex items-start gap-8">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {activeTab === 'details' && <DetailsPanel profileId={profileId} />}
          {activeTab === 'companies' && (
            <div className="overflow-x-auto">
              <CompaniesPanel profileId={profileId} />
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="overflow-x-auto">
              <ContactsPanel profileId={profileId} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 border-l border-zinc-200 pl-8 dark:border-zinc-700/50">
          <ProfileSidebar
            profileId={profileId}
            onEditSuccess={() => refetch()}
          />
        </div>
      </div>
    </>
  );
}
