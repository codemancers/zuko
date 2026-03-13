'use client';

import { BriefcaseIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Divider,
  Heading,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getTableViewDeals } from '@/server/query-options';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BaseTable, createColumnsFromMetadata, type BaseRow } from '../Table';

const DealsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data: dealsData, isLoading } = useQuery(
    getTableViewDeals({ search: searchTerm || undefined }),
  );

  const deals = dealsData?.data || [];
  const metadata = dealsData?.metadata || [];

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata),
    [metadata]
  );

  const handleDealClick = (dealId: number) => {
    router.push(`/deals/${dealId}`);
  };

  const handleNewDeal = () => {
    router.push('/deals/new');
  };

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Deals</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your sales pipeline and track deal progress
          </p>
        </div>
        <Button onClick={handleNewDeal}>
          <PlusIcon className="h-4 w-4" />
          New Deal
        </Button>
      </div>

      <Divider className="mt-6" />

      {/* Search Bar */}
      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search deals by title, summary, or source..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <BaseTable<BaseRow>
        columns={columns}
        data={deals}
        loading={isLoading}
        onRowClick={(deal) => handleDealClick(Number(deal.id))}
        totalCount={dealsData?.pagination?.total}
        entityName="deals"
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
    </>
  );
};

export default DealsList;
