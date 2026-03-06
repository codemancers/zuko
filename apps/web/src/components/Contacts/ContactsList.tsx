'use client';

import { useState } from 'react';
import { UserIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Divider,
  Heading,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getContacts } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import type { Contact } from '@/lib/api/contacts';
import { contactColumns } from './columns';
import { BaseTable } from '../Table';

const ContactsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuery(
    getContacts({ search: searchTerm || undefined }),
  );

  const contacts = data?.contacts || [];

  const handleRowClick = (contact: Contact) => {
    router.push(`/contacts/${contact.id}`);
  };

  const handleNewContact = () => {
    router.push('/contacts/new');
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

      <BaseTable
        columns={contactColumns}
        data={contacts}
        loading={isLoading}
        onRowClick={handleRowClick}
        totalCount={data?.pagination?.total}
        entityName="contacts"
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
