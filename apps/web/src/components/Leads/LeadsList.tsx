'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSheetState } from '@/hooks/use-sheet-state';
import { PlusIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { PageHeader, SearchBar } from '@/components/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { getTableViewLeadsInfinite } from '@/server/query-options';
import type { ColumnDef } from '@tanstack/react-table';
import LeadForm from './LeadForm';
import { toast } from 'sonner';
import {
  BaseTable,
  createColumnsFromMetadata,
  type BaseRow,
  TableActions,
  DeleteAction,
} from '../Table';
import { leadsApi } from '@/lib/api/leads';
import type { Lead } from '@/lib/api/leads';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useSearchParam } from '@/hooks/use-search-param';

const LeadsList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openAddColumnRef = useRef<(() => void) | undefined>(undefined);
  const [isSheetOpen, setIsSheetOpen] = useSheetState();
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<number | null>(null);
  const {
    inputValue: searchTerm,
    setInputValue: setSearchTerm,
    debouncedValue,
  } = useSearchParam();

  const {
    data: leadsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    getTableViewLeadsInfinite({
      search: debouncedValue || undefined,
    }),
  );

  const { mutate: deleteLead, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted');
      setLeadToDelete(null);
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const { mutate: convertLead } = useMutation({
    mutationFn: (id: number) =>
      leadsApi.convert(id) as Promise<{ deal?: { id?: number } }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead converted to deal');
    },
    onError: () => toast.error('Failed to convert lead'),
  });

  const leads = leadsData?.pages.flatMap((p) => p.data) ?? [];
  const metadata = leadsData?.pages[0]?.metadata ?? [];
  const totalCount = leadsData?.pages[0]?.pagination?.total;

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <Button
            plain
            className="text-xs"
            onClick={() => convertLead(Number(row.original.id))}
            disabled={
              (row.original as unknown as Record<string, unknown>)['status'] ===
              'converted'
            }
          >
            → Deal
          </Button>
          <DeleteAction
            onClick={() => setLeadToDelete(Number(row.original.id))}
            disabled={isDeleting}
          />
        </TableActions>
      ),
    }),
    [convertLead, isDeleting],
  );

  const icpProfileColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'icpProfile',
      header: 'ICP Profile',
      cell: ({ row }) => {
        const r = row.original as unknown as Record<string, unknown>;
        const name = r['icpProfile'] as string | null;
        const id = r['icpProfileId'] as number | null;
        if (!name) return null;
        if (!id) return <span>{name}</span>;
        return (
          <Link
            href={`/icps/${id}`}
            className="hover:underline hover:font-bold"
          >
            {name}
          </Link>
        );
      },
    }),
    [],
  );

  const columns = useMemo(
    () =>
      createColumnsFromMetadata<BaseRow>(metadata)
        .filter((c) => (c as { id?: string }).id !== 'icpProfile')
        .concat(icpProfileColumn, actionsColumn),
    [metadata, icpProfileColumn, actionsColumn],
  );

  const handleNewLead = () => {
    setEditLead(null);
    setIsSheetOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description="Prospects who replied to your campaigns"
        action={
          <Button onClick={handleNewLead}>
            <PlusIcon className="h-4 w-4" />
            New Lead
          </Button>
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search leads by name, email, or company..."
      />

      <BaseTable<BaseRow>
        columns={columns}
        data={leads}
        loading={isLoading}
        totalCount={totalCount}
        entityName="leads"
        showAddColumn={false}
        onAddColumn={() => {}}
        openAddColumnRef={openAddColumnRef}
        onRowClick={(row) => router.push(`/leads/${row.id}`)}
        onFetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        showEmptyState
        emptyStateConfig={{
          icon: FunnelIcon,
          title: 'No leads yet',
          description:
            'Add your first lead or connect Apollo to auto-capture replies.',
          action: { label: 'New Lead', onClick: handleNewLead },
        }}
        columnReordering={{ storageKey: 'leads-col-order' }}
      />

      <ConfirmDialog
        open={leadToDelete !== null}
        title="Delete Lead"
        description="Are you sure you want to delete this lead? This action cannot be undone."
        confirmText="Delete"
        confirmColor="red"
        onConfirm={() => {
          if (leadToDelete !== null) deleteLead(leadToDelete);
          setLeadToDelete(null);
        }}
        onClose={() => setLeadToDelete(null)}
        isLoading={isDeleting}
      />

      <Sheet open={isSheetOpen} onClose={setIsSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>{editLead ? 'Edit Lead' : 'New Lead'}</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        <LeadForm
          lead={editLead ?? undefined}
          onSuccess={() => setIsSheetOpen(false)}
        />
      </Sheet>
    </>
  );
};

export default LeadsList;
