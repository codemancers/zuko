'use client';

import { useState, useMemo } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { PageHeader, SearchBar } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTableViewContacts } from '@/server/query-options';
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
import { contactsApi } from '@/lib/api/contacts';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useSearchParam } from '@/hooks/use-search-param';

const ContactsList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { inputValue: searchTerm, setInputValue: setSearchTerm, debouncedValue } = useSearchParam();
  const [contactToDelete, setContactToDelete] = useState<number | null>(null);
  const { data: contactsData, isLoading } = useQuery(
    getTableViewContacts({ search: debouncedValue || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('contacts');

  const { addRow } = useAddRow('contacts');
  const { updateCell } = useCellUpdate('contacts');

  const hideContactMutation = useMutation({
    mutationFn: (id: number) => contactsApi.hideContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact removed');
    },
    onError: () => toast.error('Failed to remove contact'),
  });

  const contacts = contactsData?.data || [];
  const metadata = contactsData?.metadata || [];

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setContactToDelete(Number(row.original.id))}
            disabled={hideContactMutation.isPending}
          />
        </TableActions>
      ),
    }),
    [hideContactMutation.isPending],
  );

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata).concat(actionsColumn),
    [metadata, actionsColumn],
  );

  const handleRowClick = (contactId: number) => {
    router.push(`/contacts/${contactId}`);
  };


  const handleNewContactRow = () => {
    addRow();
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
        title="Contacts"
        description="Manage your sales contacts and relationships"
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search contacts by name, email, phone, or LinkedIn..."
      />

      <BaseTable<BaseRow>
        columns={columns}
        data={contacts}
        loading={isLoading}
        onRowClick={(contact) => handleRowClick(Number(contact.id))}
        onCellUpdate={(rowId, columnId, value) =>
          updateCell({ rowId, columnId, value })
        }
        totalCount={contactsData?.pagination?.total}
        entityName="contacts"
        showAddRow
        onAddRow={handleNewContactRow}
        showAddColumn
        onAddColumn={handleNewColumn}
        disableRowClick={true}
      />

      <ConfirmDialog
        open={contactToDelete !== null}
        title="Remove Contact"
        description="Are you sure you want to remove this contact? It will be hidden from your list."
        confirmText="Remove"
        confirmColor="red"
        onConfirm={() => {
          if (contactToDelete !== null) {
            hideContactMutation.mutate(contactToDelete);
          }
          setContactToDelete(null);
        }}
        onClose={() => setContactToDelete(null)}
        isLoading={hideContactMutation.isPending}
      />
    </>
  );
};

export default ContactsList;
