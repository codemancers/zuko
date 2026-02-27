'use client';

import { BuildingOfficeIcon, PlusIcon } from '@heroicons/react/24/outline';
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
import { getCompanies } from '@/server/query-options';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SalesCompany } from '@/lib/api/companies';

const CompaniesList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuery(
    getCompanies({ search: searchTerm || undefined }),
  );

  const companies = data?.companies || [];

  const handleCompanyClick = (companyId: number) => {
    router.push(`/companies/${companyId}`);
  };

  const handleNewCompany = () => {
    router.push('/companies/new');
  };

  const getPrimaryOwner = (company: SalesCompany) => {
    const primaryOwner = company.owners.find((o) => o.isPrimary);
    return primaryOwner?.user.name || company.owners[0]?.user.name || '-';
  };

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Companies</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your sales companies and relationships
          </p>
        </div>
        <Button onClick={handleNewCompany}>
          <PlusIcon className="h-4 w-4" />
          New Company
        </Button>
      </div>

      <Divider className="mt-6" />

      {/* Search Bar */}
      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search companies by name, website, or LinkedIn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isLoading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading companies...
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="mt-8">
          {companies.length === 0 ? (
            <EmptyCompaniesList />
          ) : (
            <div className="flow-root">
              <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
                <TableHead>
                  <TableRow>
                    <TableHeader>Company</TableHeader>
                    <TableHeader>Website</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Owners Count</TableHeader>
                    <TableHeader>Created</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companies.map((company: SalesCompany) => (
                    <TableRow
                      key={company.id}
                      className="transition-all duration-200 ease-in hover:cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      onClick={() => handleCompanyClick(company.id)}
                    >
                      <TableCell className="align-top">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <BuildingOfficeIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                          </div>
                          <div className="font-medium">
                            {company.companyName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {company.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {getPrimaryOwner(company)}
                      </TableCell>
                      <TableCell className="align-top">
                        {company.owners.length > 1 && (
                          <Badge color="zinc" className="text-xs">
                            +{company.owners.length - 1}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {dayjs(company.createdAt).format('MMM D, YYYY')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Info */}
              {data?.pagination && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Showing {companies.length} of {data.pagination.total}{' '}
                  companies
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export const EmptyCompaniesList = () => {
  return (
    <div className="mt-40 text-center">
      <BuildingOfficeIcon className="mx-auto h-12 w-12 text-zinc-400" />
      <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
        No Companies
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Get started by creating a new company.
      </p>
      <div className="mt-6">
        <Button href="/companies/new">
          <PlusIcon className="h-4 w-4" />
          New Company
        </Button>
      </div>
    </div>
  );
};

export default CompaniesList;
