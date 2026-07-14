'use client';

import {
  CheckIcon,
  DocumentTextIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { WikiPage, Switch, type OutputData } from '@zuko/ui-kit';
import { BackLink } from '@/components/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPage } from '@/server/query-options';
import { pagesApi, type PageDetail as PageDetailData } from '@/lib/api/pages';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { PageTableOfContents } from './PageTableOfContents';

dayjs.extend(relativeTime);

const SidebarField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="space-y-2">
    <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
      {label}
    </h3>
    <div className="text-sm text-zinc-700 dark:text-zinc-300">{children}</div>
  </div>
);

/**
 * Full-page wiki editor for a standalone page. Two-column layout ported from
 * Gather's PageDetail: main editor column + metadata sidebar (last updated,
 * table of contents, subpages).
 *
 * Invalidation discipline (learned the hard way in Gather's wiki): content
 * saves refresh ONLY the ["pages"] listing (exact key) — never this page's
 * own ["pages", id] query. Refetching the detail while the user is typing
 * re-renders WikiPage with new initialData and tears down Editor.js, wiping
 * in-progress edits. Same reason the detail query disables
 * refetchOnWindowFocus.
 */
const PageDetail = ({ pageId }: { pageId: number }) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    ...getPage(pageId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });

  // Title is kept in local state after load so saving it doesn't need a
  // detail refetch (which would remount the editor below it).
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (page) setTitle(page.title);
  }, [page]);

  // Save status shown in the header — driven by WikiPage's autosave
  // lifecycle callbacks.
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const saveTitle = useCallback(async () => {
    if (!page || title === page.title) return;
    try {
      await pagesApi.updatePage(pageId, { title: title || null });
      queryClient.setQueryData(
        ['pages', pageId],
        (old: PageDetailData | undefined) =>
          old ? { ...old, title: title || null } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['pages'], exact: true });
    } catch {
      toast.error('Failed to save title');
      setTitle(page.title);
    }
  }, [page, pageId, title, queryClient]);

  // Stable identity — depends on primitives only. setQueryData keeps the detail
  // cache fresh so navigating away and back shows the latest saved content
  // without triggering a network refetch (which would remount the editor).
  const handleSave = useCallback(
    async (data: OutputData) => {
      await pagesApi.updatePage(pageId, {
        blocks: (data.blocks ?? []) as never[],
        version: data.version,
      });
      queryClient.setQueryData(
        ['pages', pageId],
        (old: PageDetailData | undefined) =>
          old
            ? {
                ...old,
                blocks: data.blocks ?? [],
                version: data.version ?? old.version,
              }
            : old,
      );
      queryClient.invalidateQueries({ queryKey: ['pages'], exact: true });
    },
    [pageId, queryClient],
  );

  const { mutate: addSubpage, isPending: isAddingSubpage } = useMutation({
    mutationFn: () => pagesApi.createPage({ parentId: pageId }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      router.push(`/pages/${created.id}`);
    },
    onError: () => toast.error('Failed to create subpage'),
  });

  if (isLoading) {
    return <p className="px-2 text-sm text-zinc-500">Loading page…</p>;
  }

  if (isError || !page) {
    return (
      <div className="space-y-4">
        <BackLink href="/pages">Pages</BackLink>
        <p className="text-sm text-zinc-500">
          Page not found — it may have been deleted or belong to another
          organization.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-8 px-8 pt-6 pb-16">
      {/* Main content */}
      <div className="min-w-0 flex-1 border-r border-zinc-200 pr-8 dark:border-zinc-800">
        <div className="space-y-4">
          <BackLink href="/pages">Pages</BackLink>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            placeholder="Untitled"
            aria-label="Page title"
            readOnly={!isEditing}
            className="w-full border-none bg-transparent text-xl font-bold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />

          <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
              Page
            </h2>
            <div className="flex items-center gap-3 text-xs">
              {isSaving && (
                <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <svg
                    className="size-3 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </span>
              )}
              {!isSaving && lastSavedAt && (
                <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                  Saved
                  <CheckIcon className="size-3" />
                </span>
              )}
              <div className="flex items-center gap-2">
                <span
                  className={
                    isEditing
                      ? 'text-zinc-400 dark:text-zinc-500'
                      : 'font-medium text-zinc-700 dark:text-zinc-300'
                  }
                >
                  Read
                </span>
                <Switch
                  checked={isEditing}
                  onChange={setIsEditing}
                  aria-label="Toggle edit mode"
                />
                <span
                  className={
                    isEditing
                      ? 'font-medium text-zinc-700 dark:text-zinc-300'
                      : 'text-zinc-400 dark:text-zinc-500'
                  }
                >
                  Edit
                </span>
              </div>
            </div>
          </div>

          <WikiPage
            key={`${pageId}-${isEditing ? 'edit' : 'read'}`}
            pageId={pageId}
            readOnly={!isEditing}
            initialData={
              {
                blocks: page.blocks ?? [],
                version: page.version,
              } as OutputData
            }
            onSave={handleSave}
            onSaveStart={() => setIsSaving(true)}
            onSaveComplete={() => {
              setIsSaving(false);
              setLastSavedAt(new Date());
            }}
            onSaveError={() => {
              setIsSaving(false);
              toast.error('Failed to save page');
            }}
            placeholder="Write something — findings, decisions, runbooks…"
            minHeight={320}
          />
        </div>
      </div>

      {/* Metadata sidebar */}
      <aside className="sticky top-0 w-64 shrink-0 self-start">
        <div className="space-y-6">
          <SidebarField label="Last updated">
            {dayjs(page.updatedAt).fromNow()}
          </SidebarField>

          {/* Table of contents */}
          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <SidebarField label="On this page">
              <PageTableOfContents
                data={{ blocks: page.blocks ?? [] } as OutputData}
              />
            </SidebarField>
          </div>

          {/* Subpages — child pages (parent_id = this page). */}
          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <SidebarField label="Subpages">
              <div className="space-y-1.5">
                {page.subpages.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic dark:text-zinc-500">
                    No subpages yet
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {page.subpages.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/pages/${sub.id}`}
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <DocumentTextIcon className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                          <span className="truncate">
                            {sub.title || 'Untitled'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => addSubpage()}
                  disabled={isAddingSubpage}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100"
                >
                  <PlusIcon className="size-4" />
                  Add subpage
                </button>
              </div>
            </SidebarField>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default PageDetail;
