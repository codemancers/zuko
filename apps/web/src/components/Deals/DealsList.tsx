'use client';

import { BriefcaseIcon } from '@heroicons/react/24/outline';
import { PageHeader, SearchBar } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewDeals } from '@/server/query-options';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  BaseTable,
  createColumnsFromMetadata,
  type BaseRow,
  TableActions,
  DeleteAction,
} from '../Table';
import { useAddColumn } from '@/hooks/use-add-column';
import { useAddRow } from '@/hooks/use-add-row';
import { useCellUpdate } from '@/hooks/use-cell-update';
import { ColumnConfig } from '@/types/table-metadata';
import { dealsApi } from '@/lib/api/deals';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const DealsList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dealToDelete, setDealToDelete] = useState<number | null>(null);
  const { data: dealsData, isLoading } = useQuery(
    getTableViewDeals({ search: searchTerm || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('deals');

  const { addRow } = useAddRow('deals');
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

  const handleNewDealRow = () => {
    addRow();
  };

  const handleNewDeal = () => {
    router.push('/deals/new');
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
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search deals by title, summary, or source..."
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
        showAddRow
        onAddRow={handleNewDealRow}
        showAddColumn
        onAddColumn={handleNewColumn}
        disableRowClick={true}
        emptyStateConfig={{
          icon: BriefcaseIcon,
          title: 'No Deals',
          description: 'Get started by creating a new deal.',
          action: {
            label: 'New Deal',
            onClick: handleNewDeal,
          },
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
    </>
  );
};

export default DealsList;
