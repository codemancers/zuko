'use client';

import { BuildingOfficeIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Divider,
  Heading,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getCompanies } from '@/server/query-options';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { companyColumns } from './columns';
import { BaseTable } from '../Table';

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

      <BaseTable
        columns={companyColumns}
        data={companies}
        loading={isLoading}
        onRowClick={(company) => handleCompanyClick(company.id)}
        totalCount={data?.pagination?.total}
        entityName="companies"
        emptyStateConfig={{
          icon: BuildingOfficeIcon,
          title: 'No Companies',
          description: 'Get started by creating a new company.',
          action: {
            label: 'New Company',
            onClick: handleNewCompany,
          },
        }}
      />
    </>
  );
};

export default CompaniesList;
