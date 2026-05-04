'use client';

import { useState, useMemo, useRef } from 'react';
import { useSheetState } from '@/hooks/use-sheet-state';
import {
  PlusIcon,
  XMarkIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { PageHeader, SearchBar } from '@/components/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { getTableViewContactsInfinite } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import type { ColumnDef } from '@tanstack/react-table';
import ContactForm from './ContactForm';
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
import { contactsApi } from '@/lib/api/contacts';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useSearchParam } from '@/hooks/use-search-param';

const ContactsList = () => {
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
  const [contactToDelete, setContactToDelete] = useState<number | null>(null);
  const {
    data: contactsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    getTableViewContactsInfinite({ search: debouncedValue || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('contacts');

  const { updateCell } = useCellUpdate('contacts');

  const hideContactMutation = useMutation({
    mutationFn: (id: number) => contactsApi.hideContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact removed');
    },
    onError: () => toast.error('Failed to remove contact'),
  });

  const contacts = contactsData?.pages.flatMap((p) => p.data) ?? [];
  const metadata = contactsData?.pages[0]?.metadata ?? [];
  const totalCount = contactsData?.pages[0]?.pagination?.total;

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

  const handleNewContact = () => {
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
        title="Contacts"
        description="Manage your sales contacts and relationships"
        action={
          <Button onClick={handleNewContact}>
            <PlusIcon className="h-4 w-4" />
            New Contact
          </Button>
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search contacts by name, email, phone, or LinkedIn..."
        onAddColumn={() => openAddColumnRef.current?.()}
      />

      <BaseTable<BaseRow>
        columns={columns}
        data={contacts}
        loading={isLoading}
        onRowClick={(contact) => handleRowClick(Number(contact.id))}
        onCellUpdate={(rowId, columnId, value) =>
          updateCell({ rowId, columnId, value })
        }
        totalCount={totalCount}
        entityName="contacts"
        showAddColumn={false}
        onAddColumn={handleNewColumn}
        openAddColumnRef={openAddColumnRef}
        disableRowClick={true}
        onFetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        showEmptyState
        emptyStateConfig={{
          icon: UserGroupIcon,
          title: 'No contacts yet',
          description:
            'Add your first contact to start managing relationships.',
          action: { label: 'New Contact', onClick: handleNewContact },
        }}
        columnReordering={{ storageKey: 'contacts-col-order' }}
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

      <Sheet open={isSheetOpen} onClose={setIsSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>New Contact</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        {session.data && (
          <ContactForm
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

export default ContactsList;
