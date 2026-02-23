"use client";

import { BuildingOfficeIcon, PlusIcon } from "@heroicons/react/24/outline";
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
} from "@zuko/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { getAccounts } from "@/server/query-options";
import dayjs from "dayjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SalesAccount } from "@/lib/api/accounts";

const AccountsList = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const { data, isLoading } = useQuery(getAccounts({ search: searchTerm || undefined }));

  const accounts = data?.accounts || [];

  const handleAccountClick = (accountId: number) => {
    router.push(`/accounts/${accountId}`);
  };

  const handleNewAccount = () => {
    router.push('/accounts/new');
  };

  const getPrimaryOwner = (account: SalesAccount) => {
    const primaryOwner = account.owners.find(o => o.isPrimary);
    return primaryOwner?.user.name || account.owners[0]?.user.name || "-";
  };

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Accounts</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your sales accounts and company relationships
          </p>
        </div>
        <Button onClick={handleNewAccount}>
          <PlusIcon className="h-4 w-4" />
          New Account
        </Button>
      </div>

      <Divider className="mt-6" />

      {/* Search Bar */}
      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search accounts by company name, website, or LinkedIn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isLoading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading accounts...</div>
        </div>
      )}

      {!isLoading && (
        <div className="mt-8">
          {accounts.length === 0 ? (
            <EmptyAccountsList />
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
                  {accounts.map((account: SalesAccount) => (
                    <TableRow
                      key={account.id}
                      className="transition-all duration-200 ease-in hover:cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      onClick={() => handleAccountClick(account.id)}
                    >
                      <TableCell className="align-top">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <BuildingOfficeIcon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                          </div>
                          <div className="font-medium">{account.companyName}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {account.website ? (
                          <a
                            href={account.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {account.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {getPrimaryOwner(account)}
                      </TableCell>
                      <TableCell className="align-top">
                        {account.owners.length > 1 && (
                          <Badge color="zinc" className="text-xs">
                            +{account.owners.length - 1}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-sm text-zinc-600 dark:text-zinc-400">
                        {dayjs(account.createdAt).format("MMM D, YYYY")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Info */}
              {data?.pagination && (
                <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                  Showing {accounts.length} of {data.pagination.total} accounts
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export const EmptyAccountsList = () => {
  return (
    <div className="mt-40 text-center">
      <BuildingOfficeIcon className="mx-auto h-12 w-12 text-zinc-400" />
      <h3 className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white">
        No Accounts
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Get started by creating a new account.
      </p>
      <div className="mt-6">
        <Button href="/accounts/new">
          <PlusIcon className="h-4 w-4" />
          New Account
        </Button>
      </div>
    </div>
  );
};

export default AccountsList;
