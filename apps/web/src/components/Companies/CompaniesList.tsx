'use client';

import { BuildingOfficeIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Divider,
  Heading,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getTableViewCompanies } from '@/server/query-options';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BaseTable, createColumnsFromMetadata, type BaseRow } from '../Table';
import { useAddColumn } from '@/hooks/use-add-column';
import { useAddRow } from '@/hooks/use-add-row';

const CompaniesList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data: companiesData, isLoading } = useQuery(
    getTableViewCompanies({ search: searchTerm || undefined }),
  );

  const { mutate: addColumn } = useAddColumn('companies');

  const { addRow } = useAddRow('companies');

   const companies = companiesData?.data || [];
  const metadata = companiesData?.metadata || [];

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata),
    [metadata]
  );

  const handleCompanyClick = (companyId: number) => {
    router.push(`/companies/${companyId}`);
  };

  const handleNewCompanyRow = () => {
    addRow();
  };

  const handleNewCompany = () => {
    router.push('/companies/new');
  };

  const handleNewColumn = (name: string, key: string, type: string) => {
    addColumn({ label: name, columnKey: key, fieldType: type });
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

      <BaseTable<BaseRow>
        columns={columns}
        data={companies}
        loading={isLoading}
        onRowClick={(company) => handleCompanyClick(Number(company.id))}
        totalCount={companiesData?.pagination?.total}
        entityName="companies"
        showAddRow
        onAddRow={handleNewCompanyRow}
        showAddColumn
        onAddColumn={handleNewColumn}
        disableRowClick={true}
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
