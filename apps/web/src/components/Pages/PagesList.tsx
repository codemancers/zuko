'use client';

import {
  ArrowUpRightIcon,
  DocumentTextIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

import { Button, Drawer } from '@zuko/ui-kit';
import { PageHeader } from '@/components/shared';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPages } from '@/server/query-options';
import { pagesApi, type PageListItem } from '@/lib/api/pages';
import { useCallback, useMemo, useState } from 'react';
import { parseAsInteger, useQueryState } from 'nuqs';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { PageDrawer } from './PageDrawer';
import { BaseTable, TableActions, DeleteAction, type BaseRow } from '../Table';
import type { ColumnDef } from '@tanstack/react-table';

dayjs.extend(relativeTime);

const formatPageTitle = (title: string | null | undefined) =>
  title?.trim() || 'Untitled';

function formatUpdatedAt(date: string): string {
  const m = dayjs(date);
  if (!m.isValid()) return '—';
  const diffDays = m.diff(dayjs(), 'day');
  if (Math.abs(diffDays) <= 7) return m.fromNow();
  return m.format('D MMM, YY');
}

type PageRow = PageListItem & BaseRow;

const PagesList = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(getPages);
  const pages = useMemo(() => (data?.pages ?? []) as PageRow[], [data?.pages]);

  const [openId, setOpenId] = useQueryState('id', parseAsInteger);
  const [pageToDelete, setPageToDelete] = useState<PageListItem | null>(null);

  const titleById = useMemo(
    () => new Map(pages.map((p) => [p.id, p.title])),
    [pages],
  );

  const { mutateAsync: createPage, isPending: isCreating } = useMutation({
    mutationFn: () => pagesApi.createPage({ title: 'Untitled' }),
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: ['pages'], exact: true });
      void setOpenId(page.id);
    },
    onError: () => toast.error('Failed to create page'),
  });

  const { mutate: deletePage, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => pagesApi.deletePage(id),
    onSuccess: (_data, deletedId) => {
      void queryClient.invalidateQueries({ queryKey: ['pages'], exact: true });
      setPageToDelete(null);
      if (openId === deletedId) void setOpenId(null);
      toast.success('Page deleted');
    },
    onError: () => toast.error('Failed to delete page'),
  });

  const actionsColumn: ColumnDef<PageRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <TableActions>
          <DeleteAction
            onClick={() => setPageToDelete(row.original)}
            disabled={isDeleting}
          />
        </TableActions>
      ),
    }),
    [isDeleting],
  );

  const columns = useMemo<ColumnDef<PageRow>[]>(
    () => [
      {
        id: 'title',
        header: 'Title',
        accessorKey: 'title',
        cell: ({ row }) => (
          <div className="group/title flex items-center gap-2">
            <button
              type="button"
              onClick={() => void setOpenId(row.original.id)}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {formatPageTitle(row.original.title)}
            </button>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/title:opacity-100">
              <button
                type="button"
                onClick={() => void setOpenId(row.original.id)}
                aria-label="Open in side drawer"
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Image
                  src="/icons/panel-right.svg"
                  alt=""
                  aria-hidden
                  width={16}
                  height={16}
                  className="size-4 dark:invert"
                />
              </button>
              <Link
                href={`/pages/${row.original.id}`}
                aria-label="Open full page"
                onClick={(e) => e.stopPropagation()}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: 'parent',
        header: 'Parent',
        accessorKey: 'parentId',
        cell: ({ row }) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {row.original.parentId != null
              ? formatPageTitle(titleById.get(row.original.parentId))
              : '—'}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Last Updated',
        accessorKey: 'updatedAt',
        cell: ({ row }) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {formatUpdatedAt(row.original.updatedAt)}
          </span>
        ),
      },
      actionsColumn,
    ],
    [titleById, actionsColumn],
  );

  const handleNewPage = useCallback(async () => {
    await createPage();
  }, [createPage]);

  return (
    <>
      <PageHeader
        title="Wiki"
        description="Capture findings, decisions, and runbooks for your team"
        action={
          <Button onClick={handleNewPage} disabled={isCreating}>
            <PlusIcon className="h-4 w-4" />
            New Page
          </Button>
        }
      />

      <BaseTable<PageRow>
        columns={columns}
        data={pages}
        loading={isLoading}
        onRowClick={(row) => void setOpenId(row.id as number)}
        totalCount={pages.length}
        entityName="pages"
        showEmptyState
        emptyStateConfig={{
          icon: DocumentTextIcon,
          title: 'No pages yet',
          description:
            'Create your first page to capture findings and decisions.',
          action: { label: 'New Page', onClick: handleNewPage },
        }}
      />

      <Drawer
        open={openId != null}
        onClose={() => void setOpenId(null)}
        size="3xl"
      >
        {openId != null && <PageDrawer pageId={openId} />}
      </Drawer>

      <ConfirmDialog
        open={pageToDelete !== null}
        onClose={() => setPageToDelete(null)}
        onConfirm={() => pageToDelete && deletePage(pageToDelete.id)}
        title="Delete page"
        description={`Delete "${formatPageTitle(pageToDelete?.title)}"? Subpages are deleted with it. This cannot be undone.`}
        confirmText="Delete"
        confirmColor="red"
        isLoading={isDeleting}
      />
    </>
  );
};

export default PagesList;
