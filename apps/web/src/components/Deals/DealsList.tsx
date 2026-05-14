'use client';

import {
  PlusIcon,
  XMarkIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline';
import { Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { PageHeader, SearchBar } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewDeals } from '@/server/query-options';
import { useState, useMemo, useRef } from 'react';
import { useSheetState } from '@/hooks/use-sheet-state';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import type { ColumnDef } from '@tanstack/react-table';
import DealForm from './DealForm';
import { toast } from 'sonner';
import {
  BaseTable,
  createColumnsFromMetadata,
  type BaseRow,
  TableActions,
  DeleteAction,
} from '../Table';
import { useAddColumn } from '@/hooks/use-add-column';
import { useCellUpdate } from '@/hooks/use-cell-update';
import type { ColumnConfig } from '@/types/table-metadata';
import { dealsApi } from '@/lib/api/deals';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useSearchParam } from '@/hooks/use-search-param';

const DealsList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openAddColumnRef = useRef<(() => void) | undefined>(undefined);
  const [isSheetOpen, setIsSheetOpen] = useSheetState();
  const session = authClient.useSession();
  const {
    inputValue: searchTerm,
    setInputValue: setSearchTerm,
    debouncedValue,
  } = useSearchParam();
  const [dealToDelete, setDealToDelete] = useState<number | null>(null);
  const { data: dealsData, isLoading } = useQuery(
    getTableViewDeals({ search: debouncedValue || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('deals');

  const { updateCell } = useCellUpdate('deals');

  const hideDealMutation = useMutation({
    mutationFn: (id: number) => dealsApi.hideDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal removed');
    },
    onError: () => toast.error('Failed to remove deal'),
  });

  const deals = dealsData?.data || [];
  const metadata = dealsData?.metadata || [];

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setDealToDelete(Number(row.original.id))}
            disabled={hideDealMutation.isPending}
          />
        </TableActions>
      ),
    }),
    [hideDealMutation.isPending],
  );

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata).concat(actionsColumn),
    [metadata, actionsColumn],
  );

  const handleDealClick = (dealId: number) => {
    router.push(`/deals/${dealId}`);
  };

  const handleNewDeal = () => {
    setIsSheetOpen(true);
  };

  const handleNewColumn = (
    name: string,
    key: string,
    type: string,
    config?: ColumnConfig,
  ) => {
    addColumn({ label: name, columnKey: key, fieldType: type, config });
  };

  return (
    <>
      <PageHeader
        title="Deals"
        description="Manage your sales pipeline and track deal progress"
        action={
          <Button onClick={handleNewDeal}>
            <PlusIcon className="h-4 w-4" />
            New Deal
          </Button>
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search deals by title, summary, or source..."
        onAddColumn={() => openAddColumnRef.current?.()}
      />

      <BaseTable<BaseRow>
        columns={columns}
        data={deals}
        loading={isLoading}
        onRowClick={(deal) => handleDealClick(Number(deal.id))}
        onCellUpdate={(rowId, columnId, value) =>
          updateCell({ rowId, columnId, value })
        }
        totalCount={dealsData?.pagination?.total}
        entityName="deals"
        showAddColumn={false}
        onAddColumn={handleNewColumn}
        openAddColumnRef={openAddColumnRef}
        disableRowClick={true}
        showEmptyState
        emptyStateConfig={{
          icon: BriefcaseIcon,
          title: 'No deals yet',
          description:
            'Create your first deal to start tracking your pipeline.',
          action: { label: 'New Deal', onClick: handleNewDeal },
        }}
      />

      <ConfirmDialog
        open={dealToDelete !== null}
        title="Remove Deal"
        description="Are you sure you want to remove this deal? It will be hidden from your list."
        confirmText="Remove"
        confirmColor="red"
        onConfirm={() => {
          if (dealToDelete !== null) {
            hideDealMutation.mutate(dealToDelete);
          }
          setDealToDelete(null);
        }}
        onClose={() => setDealToDelete(null)}
        isLoading={hideDealMutation.isPending}
      />

      <Sheet open={isSheetOpen} onClose={setIsSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>New Deal</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        {session.data && (
          <DealForm
            mode="create"
            currentUserId={parseInt(session.data.user.id, 10)}
            onSuccess={() => setIsSheetOpen(false)}
            onCancel={() => setIsSheetOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
};

export default DealsList;
