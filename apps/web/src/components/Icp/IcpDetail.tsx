'use client';

import { useState } from 'react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useRouter } from 'next/navigation';
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
  ErrorMessage,
  Field,
  Heading,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
} from '@zuko/ui-kit';
import { LinkIcon, PencilIcon, PlusIcon } from '@heroicons/react/20/solid';
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
import type {
  ApolloOrganization,
  ApolloPerson,
  IcpFilters,
  PreviewFiltersResponse,
} from '@/lib/api/icp';
import {
  EMPLOYEE_RANGE_LABEL,
  REGION_OPTIONS,
  SUB_INDUSTRY_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  REVENUE_STATUS_OPTIONS,
  FUNDING_STATUS_OPTIONS,
  FUNDING_STAGE_OPTIONS,
  WORKFLOW_COMPLEXITY_OPTIONS,
  OPERATIONAL_BOTTLENECK_OPTIONS,
  AUTOMATION_OPPORTUNITY_OPTIONS,
  AI_TRANSFORMATION_SIGNAL_OPTIONS,
  BUDGET_LIKELIHOOD_OPTIONS,
  PRODUCT_MATURITY_OPTIONS,
  CONSULTING_FIT_OPTIONS,
} from '@/lib/constants/icp';

function optionsToMap(
  opts: { label: string; value: string }[],
): Record<string, string> {
  return Object.fromEntries(opts.map((o) => [o.value, o.label]));
}
import { editorJsonToMarkdown } from '@/lib/editor-utils';
import IcpForm from './IcpForm';
import IcpCampaignsPanel from './IcpCampaignsPanel';
import { apolloSequencesApi } from '@/lib/api/apollo';
import { toast } from 'sonner';
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
  {
    accessorKey: 'linkedin_url',
    header: 'LinkedIn',
    cell: ({ getValue }) => {
      const url = getValue<string>();
      if (!url) return '—';
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline text-xs"
        >
          Profile
        </a>
      );
    },
  },
];

const contactColumns: ColumnDef<ApolloPerson & { id: string }>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const person = row.original;
      const firstName = person.first_name || '';
      const lastName = person.last_name_obfuscated || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || '';
      const initials =
        (
          (firstName.charAt(0) || '') + (lastName.charAt(0) || '')
        ).toUpperCase() || '??';
      return (
        <div className="flex items-center gap-3">
          <Avatar
            initials={initials}
            alt={fullName}
            className="size-7 bg-zinc-200 dark:bg-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
          />
          <span className="font-medium text-zinc-900 dark:text-white">
            {fullName}
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
      return p.has_city || p.has_state || p.has_country ? '***' : '—';
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

type Tab = 'details' | 'companies' | 'contacts' | 'campaigns';

const TAB_VALUES = ['details', 'companies', 'contacts', 'campaigns'] as const;
const tabParser = parseAsStringLiteral(TAB_VALUES).withDefault('details');

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'companies', label: 'Companies' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'campaigns', label: 'Campaigns' },
];

// ---------- Details Panel ----------

function DetailsPanel({ profileId }: { profileId: number }) {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(getIcpProfile(profileId));

  const notesMutation = useMutation({
    mutationFn: (notes: OutputData) =>
      icpApi.updateProfile(profileId, {
        notes: notes as unknown as Record<string, unknown>,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['icp', 'profile', profileId],
      }),
  });

  // Fall back to description content if notes is empty
  const initialNotes = ensureOutputData(profile?.notes ?? profile?.description);

  const notesField = useAutosaveField<OutputData>(initialNotes, {
    fieldName: 'notes',
    onSave: (val) => notesMutation.mutateAsync(val),
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Notes
          </p>
          {notesField.isSaving && (
            <span className="text-xs text-zinc-400">Saving…</span>
          )}
        </div>
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

// ---------- Compiled Filters Preview Sheet ----------

function FilterBadges({
  label,
  items,
  color,
  map,
}: {
  label: string;
  items?: string[];
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'zinc';
  map?: Record<string, string>;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </Text>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {items.map((v) => (
          <Badge key={v} color={color}>
            {map?.[v] ?? v}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CompiledFiltersPreviewSheet({
  open,
  filters,
  counts,
  isApplying,
  onApply,
  onClose,
}: {
  open: boolean;
  filters: IcpFilters | null;
  counts: PreviewFiltersResponse | null;
  isApplying: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <SheetTitle>Compiled Filters Preview</SheetTitle>
      </SheetHeader>
      <SheetBody>
        <div className="space-y-5">
          {counts &&
            (() => {
              const noResults =
                (counts.companiesCount ?? 0) === 0 &&
                (counts.contactsCount ?? 0) === 0;
              return (
                <div
                  className={`rounded-lg px-4 py-3 ${noResults ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-zinc-50 dark:bg-zinc-900'}`}
                >
                  <Text
                    className={`text-sm font-medium ${noResults ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300'}`}
                  >
                    {noResults
                      ? 'No matches found — filters may be too narrow. Try simplifying your notes and recompiling.'
                      : [
                          counts.companiesCount != null
                            ? `${counts.companiesCount.toLocaleString()} companies`
                            : null,
                          counts.contactsCount != null
                            ? `${counts.contactsCount.toLocaleString()} contacts`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') + ' match'}
                  </Text>
                </div>
              );
            })()}

          {filters && (
            <div className="space-y-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Company Filters
              </Text>
              <FilterBadges
                label="Industries"
                items={filters.industries}
                color="blue"
              />
              <FilterBadges
                label="Employee Ranges"
                items={filters.employeeRanges}
                color="green"
                map={EMPLOYEE_RANGE_LABEL}
              />
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
              <FilterBadges
                label="Locations"
                items={filters.locations}
                color="orange"
              />
              <FilterBadges
                label="Exclude Locations"
                items={filters.excludeLocations}
                color="red"
              />
              <FilterBadges
                label="Technologies (any of)"
                items={filters.technologiesAnyOf}
                color="purple"
              />
              <FilterBadges
                label="Technologies (all of)"
                items={filters.technologiesAllOf}
                color="purple"
              />
              <FilterBadges
                label="Technologies (none of)"
                items={filters.technologiesNoneOf}
                color="zinc"
              />
              {filters.organizationName && (
                <div>
                  <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Organization Name
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {filters.organizationName}
                  </Text>
                </div>
              )}
              <FilterBadges
                label="Domains"
                items={filters.organizationDomains}
                color="zinc"
              />

              <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                People Filters
              </Text>
              <FilterBadges
                label="Job Titles"
                items={filters.personTitles}
                color="blue"
              />
              <FilterBadges
                label="Seniorities"
                items={filters.personSeniorities}
                color="green"
              />
              <FilterBadges
                label="Person Locations"
                items={filters.personLocations}
                color="orange"
              />
              <FilterBadges
                label="Email Status"
                items={filters.contactEmailStatus}
                color="zinc"
              />
              {filters.keywords && (
                <div>
                  <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Keywords
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {filters.keywords}
                  </Text>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" plain onClick={onClose} disabled={isApplying}>
          Cancel
        </Button>
        <Button
          type="button"
          color="dark"
          onClick={onApply}
          disabled={isApplying}
        >
          {isApplying ? 'Applying…' : 'Apply Filters'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

// ---------- Sidebar ----------

function ProfileSidebar({
  profileId,
  onEditSuccess,
  compiledFilters,
  previewCounts,
  isPreviewOpen,
  setIsPreviewOpen,
  applyMutation,
  onCompile,
  isCompiling,
}: {
  profileId: number;
  onEditSuccess: () => void;
  compiledFilters: IcpFilters | null;
  previewCounts: PreviewFiltersResponse | null;
  isPreviewOpen: boolean;
  setIsPreviewOpen: (open: boolean) => void;
  applyMutation: ReturnType<typeof useMutation<unknown, Error, IcpFilters>>;
  onCompile: () => void;
  isCompiling: boolean;
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

      <CompiledFiltersPreviewSheet
        open={isPreviewOpen}
        filters={compiledFilters}
        counts={previewCounts}
        isApplying={applyMutation.isPending}
        onApply={() => compiledFilters && applyMutation.mutate(compiledFilters)}
        onClose={() => setIsPreviewOpen(false)}
      />

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Profile Details
          </Text>
          <Button
            onClick={() => setIsSheetOpen(true)}
            className="text-xs text-zinc-500"
          >
            <PencilIcon className="size-3" />
            Edit
          </Button>
        </div>

        <Button
          onClick={onCompile}
          disabled={isCompiling}
          className="w-full"
          color="dark"
        >
          {isCompiling ? 'Compiling…' : 'Compile Filters from Notes'}
        </Button>

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
                  {EMPLOYEE_RANGE_LABEL[r] ?? r}
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

        <FilterBadges
          label="Region"
          items={filters.region}
          color="blue"
          map={optionsToMap(REGION_OPTIONS)}
        />
        <FilterBadges
          label="Sub-industry"
          items={filters.subIndustry}
          color="purple"
          map={optionsToMap(SUB_INDUSTRY_OPTIONS)}
        />
        <FilterBadges
          label="Company Type"
          items={filters.companyType}
          color="zinc"
          map={optionsToMap(COMPANY_TYPE_OPTIONS)}
        />
        <FilterBadges
          label="Revenue Status"
          items={filters.revenueStatus}
          color="green"
          map={optionsToMap(REVENUE_STATUS_OPTIONS)}
        />
        <FilterBadges
          label="Funding Status"
          items={filters.fundingStatus}
          color="blue"
          map={optionsToMap(FUNDING_STATUS_OPTIONS)}
        />
        <FilterBadges
          label="Funding Stage"
          items={filters.fundingStage}
          color="purple"
          map={optionsToMap(FUNDING_STAGE_OPTIONS)}
        />
        <FilterBadges
          label="Primary Buyer Title"
          items={filters.primaryBuyerTitle}
          color="orange"
        />
        <FilterBadges
          label="Secondary Buyer Titles"
          items={filters.secondaryBuyerTitles}
          color="zinc"
        />
        <FilterBadges
          label="Workflow Complexity"
          items={filters.workflowComplexity}
          color="zinc"
          map={optionsToMap(WORKFLOW_COMPLEXITY_OPTIONS)}
        />
        <FilterBadges
          label="Operational Bottlenecks"
          items={filters.operationalBottlenecks}
          color="red"
          map={optionsToMap(OPERATIONAL_BOTTLENECK_OPTIONS)}
        />
        <FilterBadges
          label="Automation Opportunity"
          items={filters.automationOpportunity}
          color="green"
          map={optionsToMap(AUTOMATION_OPPORTUNITY_OPTIONS)}
        />
        <FilterBadges
          label="AI Transformation Signal"
          items={filters.aiTransformationSignal}
          color="blue"
          map={optionsToMap(AI_TRANSFORMATION_SIGNAL_OPTIONS)}
        />
        <FilterBadges
          label="Budget Likelihood"
          items={filters.budgetLikelihood}
          color="green"
          map={optionsToMap(BUDGET_LIKELIHOOD_OPTIONS)}
        />
        <FilterBadges
          label="Product Maturity"
          items={filters.productMaturity}
          color="purple"
          map={optionsToMap(PRODUCT_MATURITY_OPTIONS)}
        />
        <FilterBadges
          label="Consulting Fit"
          items={filters.consultingFit}
          color="blue"
          map={optionsToMap(CONSULTING_FIT_OPTIONS)}
        />
        <FilterBadges
          label="Exclusion Tags"
          items={filters.exclusionTags}
          color="red"
        />

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

// ---------- New Campaign Sheet ----------

function NewCampaignSheet({
  open,
  onClose,
  profileId,
}: {
  open: boolean;
  onClose: () => void;
  profileId: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      apolloSequencesApi.createMeta({
        name: name.trim(),
        icpProfileId: profileId,
      }),
    onSuccess: (campaign) => {
      toast.success('Campaign created');
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'by-icp', profileId],
      });
      onClose();
      setName('');
      router.push(`/campaigns/${campaign.id}`);
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    createMutation.mutate();
  };

  const handleClose = () => {
    setName('');
    setNameError('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={handleClose}>
      <SheetHeader>
        <SheetTitle>New Campaign</SheetTitle>
      </SheetHeader>
      <SheetBody>
        <Field>
          <Label>Campaign name</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 Outreach — SaaS Companies"
            disabled={createMutation.isPending}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          {nameError && <ErrorMessage>{nameError}</ErrorMessage>}
        </Field>
      </SheetBody>
      <SheetFooter>
        <Button plain onClick={handleClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          color="dark"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}

// ---------- Main Component ----------

export default function IcpDetail({ profileId }: IcpDetailProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useQueryState('tab', tabParser);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compiledFilters, setCompiledFilters] = useState<IcpFilters | null>(
    null,
  );
  const [previewCounts, setPreviewCounts] =
    useState<PreviewFiltersResponse | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const {
    data: profile,
    isLoading,
    refetch,
  } = useQuery(getIcpProfile(profileId));

  const applyMutation = useMutation({
    mutationFn: (filters: IcpFilters) =>
      icpApi.updateProfile(profileId, { filters }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['icp', 'profile', profileId],
      });
      queryClient.invalidateQueries({
        queryKey: ['icp', 'companies', profileId],
      });
      queryClient.invalidateQueries({
        queryKey: ['icp', 'contacts', profileId],
      });
      setIsPreviewOpen(false);
      toast.success('Filters applied');
    },
    onError: () => toast.error('Failed to apply filters'),
  });

  async function handleCompile() {
    const source = profile?.notes ?? profile?.description;
    if (!source) return;
    const text = editorJsonToMarkdown(JSON.stringify(source));
    if (!text) return;
    setIsCompiling(true);
    try {
      const filters = await icpApi.compileDescription(text);
      const counts = await icpApi.previewFilters(profileId, filters);
      setCompiledFilters(filters);
      setPreviewCounts(counts);
      setIsPreviewOpen(true);
    } catch {
      toast.error('Failed to compile description');
    } finally {
      setIsCompiling(false);
    }
  }

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

      <div className="mt-4 flex items-center justify-between">
        <Heading>{profile.name}</Heading>
        {activeTab === 'campaigns' && (
          <Button onClick={() => setNewCampaignOpen(true)}>
            <PlusIcon className="size-4" />
            New Campaign
          </Button>
        )}
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
          {activeTab === 'campaigns' && (
            <IcpCampaignsPanel
              profileId={profileId}
              onNew={() => setNewCampaignOpen(true)}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 border-l border-zinc-200 pl-8 dark:border-zinc-700/50">
          <ProfileSidebar
            profileId={profileId}
            onEditSuccess={() => refetch()}
            compiledFilters={compiledFilters}
            previewCounts={previewCounts}
            isPreviewOpen={isPreviewOpen}
            setIsPreviewOpen={setIsPreviewOpen}
            applyMutation={applyMutation}
            onCompile={handleCompile}
            isCompiling={isCompiling}
          />
        </div>
      </div>

      <NewCampaignSheet
        open={newCampaignOpen}
        onClose={() => setNewCampaignOpen(false)}
        profileId={profileId}
      />
    </>
  );
}
