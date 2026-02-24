'use client';

import { UserIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Badge,
  Divider,
  Heading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getContacts } from '@/server/query-options';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact } from '@/lib/api/contacts';

const ContactsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuery(
    getContacts({ search: searchTerm || undefined })
  );

  const contacts = data?.contacts || [];

  const handleContactClick = (contactId: number) => {
    router.push(`/contacts/${contactId}`);
  };

  const handleNewContact = () => {
    router.push('/contacts/new');
  };

  const getPrimaryOwner = (contact: Contact) => {
    const primaryOwner = contact.owners.find((o) => o.isPrimary);
    return primaryOwner?.user.name || contact.owners[0]?.user.name || '-';
  };

  const getContactMethod = (contact: Contact) => {
    if (contact.email) return contact.email;
    if (contact.phone) return contact.phone;
    if (contact.linkedinId) return `LinkedIn: ${contact.linkedinId}`;
    return '-';
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

      {isLoading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading contacts...
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="mt-8">
          {contacts.length === 0 ? (
            <EmptyContactsList />
          ) : (
            <div className="flow-root">
              <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
                <TableHead>
                  <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Contact Info</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Owners Count</TableHeader>
                    <TableHeader>Created</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map((contact: Contact) => (
                    <TableRow
                      key={contact.id}
                      className="transition-all duration-200 ease-in hover:cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      onClick={() => handleContactClick(contact.id)}
                    >
                      <TableCell className="align-top">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <UserIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                          </div>
                          <div className="font-medium">{contact.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {getContactMethod(contact)}
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {getPrimaryOwner(contact)}
                      </TableCell>
                      <TableCell className="align-top">
                        {contact.owners.length > 1 && (
                          <Badge color="zinc" className="text-xs">
                            +{contact.owners.length - 1}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {dayjs(contact.createdAt).format('MMM D, YYYY')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Info */}
              {data?.pagination && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Showing {contacts.length} of {data.pagination.total} contacts
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export const EmptyContactsList = () => {
  return (
    <div className="mt-40 text-center">
      <UserIcon className="mx-auto h-12 w-12 text-zinc-400" />
      <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
        No Contacts
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Get started by creating a new contact.
      </p>
      <div className="mt-6">
        <Button href="/contacts/new">
          <PlusIcon className="h-4 w-4" />
          New Contact
        </Button>
      </div>
    </div>
  );
};

export default ContactsList;
