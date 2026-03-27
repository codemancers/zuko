'use client';

import { useState, useMemo } from 'react';
import { UserIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Divider,
  Heading,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getTableViewContacts } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { BaseTable, createColumnsFromMetadata, type BaseRow } from '../Table';
import { useAddColumn } from '@/hooks/use-add-column';
import { useAddRow } from '@/hooks/use-add-row';

const ContactsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data: contactsData, isLoading } = useQuery(
    getTableViewContacts({ search: searchTerm || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('contacts');

  const { addRow } = useAddRow('contacts');

  const contacts = contactsData?.data || [];
  const metadata = contactsData?.metadata || [];

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata),
    [metadata]
  );

  const handleRowClick = (contactId: number) => {
    router.push(`/contacts/${contactId}`);
  };

  const handleNewContact = () => {
    router.push('/contacts/new');
  };

  const handleNewContactRow = () => {
    addRow();
  };

  const handleNewColumn = (name: string, key: string, type: string) => {
    addColumn({ label: name, columnKey: key, fieldType: type });
  };

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Contacts</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your sales contacts and relationships
          </p>
        </div>
        <Button onClick={handleNewContact}>
          <PlusIcon className="h-4 w-4" />
          New Contact
        </Button>
      </div>

      <Divider className="mt-6" />

      {/* Search Bar */}
      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search contacts by name, email, phone, or LinkedIn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <BaseTable<BaseRow>
        columns={columns}
        data={contacts}
        loading={isLoading}
        onRowClick={(contact) => handleRowClick(Number(contact.id))}
        totalCount={contactsData?.pagination?.total}
        entityName="contacts"
        showAddRow
        onAddRow={handleNewContactRow}
        showAddColumn
        onAddColumn={handleNewColumn}
        disableRowClick={true}
        emptyStateConfig={{
          icon: UserIcon,
          title: 'No Contacts',
          description: 'Get started by creating a new contact.',
          action: {
            label: 'New Contact',
            onClick: handleNewContact,
          },
        }}
      />
    </>
  );
};

export default ContactsList;
