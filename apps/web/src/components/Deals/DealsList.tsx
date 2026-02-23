"use client";

import { BriefcaseIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  Badge,
  Divider,
  Heading,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
} from "@zuko/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { getDeals } from "@/server/query-options";
import dayjs from "dayjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/lib/api/deals";

const DealsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading } = useQuery(getDeals({ search: searchTerm || undefined }));

  const deals = data?.deals || [];

  // Define stage priority (lower number = higher priority)
  const stagePriority: Record<string, number> = {
    'negotiation': 1,
    'proposal': 2,
    'qualification': 3,
    'prospecting': 4,
    'closed_won': 5,
    'closed_lost': 6,
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
      return new Date(a.expectedCloseDate).getTime() - new Date(b.expectedCloseDate).getTime();
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

  const getPrimaryOwner = (deal: Deal) => {
    const primaryOwner = deal.owners.find(o => o.isPrimary);
    return primaryOwner?.user.name || deal.owners[0]?.user.name || "-";
  };

  const getPrimaryAccount = (deal: Deal) => {
    if (!deal.accounts || deal.accounts.length === 0) return null;
    const primaryAccount = deal.accounts.find(a => a.isPrimary);
    return primaryAccount || deal.accounts[0] || null;
  };

  const formatCurrency = (value?: number, currency?: string) => {
    if (value === undefined || value === null) return "-";
    const curr = currency || "USD";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stage: string): "zinc" | "blue" | "yellow" | "green" | "red" => {
    const stageColors: Record<string, "zinc" | "blue" | "yellow" | "green" | "red"> = {
      prospecting: "zinc",
      qualification: "blue",
      proposal: "yellow",
      negotiation: "yellow",
      closed_won: "green",
      closed_lost: "red",
    };
    return stageColors[stage] || "zinc";
  };

  const formatStage = (stage: string) => {
    return stage
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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

      {isLoading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading deals...</div>
        </div>
      )}

      {!isLoading && (
        <div className="mt-8">
          {deals.length === 0 ? (
            <EmptyDealsList />
          ) : (
            <div className="flow-root">
              <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
                <TableHead>
                  <TableRow>
                    <TableHeader>Title</TableHeader>
                    <TableHeader>Value</TableHeader>
                    <TableHeader>Stage</TableHeader>
                    <TableHeader>Probability</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Expected Close</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedDeals.map((deal: Deal) => {
                    const account = getPrimaryAccount(deal);
                    return (
                      <TableRow
                        key={deal.id}
                        className="transition-all duration-200 ease-in hover:cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        onClick={() => handleDealClick(deal.id)}
                      >
                        <TableCell className="align-top">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <BriefcaseIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                            </div>
                            <div>
                              <div className="font-medium">{deal.title}</div>
                              {account && (
                                <Link
                                  href={`/accounts/${account.accountId}`}
                                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:underline"
                                >
                                  {account.account.companyName}
                                </Link>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                          {formatCurrency(deal.value, deal.currency)}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge color={getStageColor(deal.stage)} className="text-xs">
                            {formatStage(deal.stage)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                          {deal.probability !== undefined && deal.probability !== null ? `${deal.probability}%` : "-"}
                        </TableCell>
                        <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                          {getPrimaryOwner(deal)}
                        </TableCell>
                        <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                          {deal.expectedCloseDate
                            ? dayjs(deal.expectedCloseDate).format("MMM D, YYYY")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination Info */}
              {data?.pagination && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Showing {sortedDeals.length} of {data.pagination.total} deals
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export const EmptyDealsList = () => {
  return (
    <div className="mt-40 text-center">
      <BriefcaseIcon className="mx-auto h-12 w-12 text-zinc-400" />
      <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
        No Deals
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Get started by creating a new deal.
      </p>
      <div className="mt-6">
        <Button href="/deals/new">
          <PlusIcon className="h-4 w-4" />
          New Deal
        </Button>
      </div>
    </div>
  );
};

export default DealsList;
