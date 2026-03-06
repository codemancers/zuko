'use client';

import { BriefcaseIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Divider,
  Heading,
  Button,
  Input,
} from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getDeals } from '@/server/query-options';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dealColumns } from './columns';
import { BaseTable } from '../Table';

const DealsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { data, isLoading } = useQuery(
    getDeals({ search: searchTerm || undefined }),
  );

  const deals = data?.deals || [];

  // Define stage priority (lower number = higher priority)
  const stagePriority: Record<string, number> = {
    negotiation: 1,
    proposal: 2,
    qualification: 3,
    prospecting: 4,
    closed_won: 5,
    closed_lost: 6,
  };

  // Sort by: 1) Stage priority, 2) Probability (desc), 3) Expected close date (asc)
  const sortedDeals = [...deals].sort((a, b) => {
    // First, sort by stage priority
    const stageA = stagePriority[a.stage] ?? 999;
    const stageB = stagePriority[b.stage] ?? 999;
    if (stageA !== stageB) {
      return stageA - stageB;
    }

    // If stages are equal, sort by probability (higher probability first)
    const probA = a.probability ?? 0;
    const probB = b.probability ?? 0;
    if (probA !== probB) {
      return probB - probA;
    }

    // If probabilities are equal, sort by expected close date (earlier dates first)
    if (a.expectedCloseDate && b.expectedCloseDate) {
      return (
        new Date(a.expectedCloseDate).getTime() -
        new Date(b.expectedCloseDate).getTime()
      );
    }
    if (a.expectedCloseDate) return -1;
    if (b.expectedCloseDate) return 1;
    return 0;
  });

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

      <BaseTable
        columns={dealColumns}
        data={sortedDeals}
        loading={isLoading}
        onRowClick={(deal) => handleDealClick(deal.id)}
        totalCount={data?.pagination?.total}
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
