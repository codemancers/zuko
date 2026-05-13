'use client';

import { PlusIcon, XMarkIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { PageHeader, SearchBar } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewCompanies } from '@/server/query-options';
import { useState, useMemo, useRef } from 'react';
import { useSheetState } from '@/hooks/use-sheet-state';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import type { ColumnDef } from '@tanstack/react-table';
import CompanyForm from './CompanyForm';
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
import { companiesApi } from '@/lib/api/companies';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useSearchParam } from '@/hooks/use-search-param';

const CompaniesList = () => {
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
  const [companyToDelete, setCompanyToDelete] = useState<number | null>(null);
  const { data: companiesData, isLoading } = useQuery(
    getTableViewCompanies({ search: debouncedValue || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('companies');

  const { updateCell } = useCellUpdate('companies');

  const hideCompanyMutation = useMutation({
    mutationFn: (id: number) => companiesApi.hideCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company removed');
    },
    onError: () => toast.error('Failed to remove company'),
  });

  const companies = companiesData?.data || [];
  const metadata = companiesData?.metadata || [];

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setCompanyToDelete(Number(row.original.id))}
            disabled={hideCompanyMutation.isPending}
          />
        </TableActions>
      ),
    }),
    [hideCompanyMutation.isPending],
  );

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata).concat(actionsColumn),
    [metadata, actionsColumn],
  );

  const handleCompanyClick = (companyId: number) => {
    router.push(`/companies/${companyId}`);
  };

  const handleNewCompany = () => {
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
        title="Companies"
        description="Manage your sales companies and relationships"
        action={
          <Button onClick={handleNewCompany}>
            <PlusIcon className="h-4 w-4" />
            New Company
          </Button>
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search companies by name, website, or LinkedIn..."
        onAddColumn={() => openAddColumnRef.current?.()}
      />

      <BaseTable<BaseRow>
        columns={columns}
        data={companies}
        loading={isLoading}
        onRowClick={(company) => handleCompanyClick(Number(company.id))}
        onCellUpdate={(rowId, columnId, value) =>
          updateCell({ rowId, columnId, value })
        }
        totalCount={companiesData?.pagination?.total}
        entityName="companies"
        showAddColumn={false}
        onAddColumn={handleNewColumn}
        openAddColumnRef={openAddColumnRef}
        disableRowClick={true}
        showEmptyState
        emptyStateConfig={{
          icon: BuildingOfficeIcon,
          title: 'No companies yet',
          description: 'Add your first company to start managing accounts.',
          action: { label: 'New Company', onClick: handleNewCompany },
        }}
      />

      <ConfirmDialog
        open={companyToDelete !== null}
        title="Remove Company"
        description="Are you sure you want to remove this company? It will be hidden from your list."
        confirmText="Remove"
        confirmColor="red"
        onConfirm={() => {
          if (companyToDelete !== null) {
            hideCompanyMutation.mutate(companyToDelete);
          }
          setCompanyToDelete(null);
        }}
        onClose={() => setCompanyToDelete(null)}
        isLoading={hideCompanyMutation.isPending}
      />

      <Sheet open={isSheetOpen} onClose={setIsSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>New Company</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        {session.data && (
          <CompanyForm
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

export default CompaniesList;
