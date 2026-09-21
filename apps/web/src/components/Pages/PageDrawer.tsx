'use client';

import { EmptyState } from '@/components/shared';
import { Heading, Spinner, WikiPage } from '@zuko/ui-kit';
import {
  ArrowUpRightIcon,
  CheckIcon,
  DocumentTextIcon,
} from '@heroicons/react/20/solid';
import Link from 'next/link';
import { usePageDetailEditor } from '@/hooks/use-page-detail-editor';

type PageDrawerProps = {
  pageId: number;
};

const formatPageTitle = (title: string | null | undefined) =>
  title?.trim() || 'Untitled';

/**
 * Drawer-shaped page detail: sticky title, the editable page body, and a
 * subpages list. Reuses usePageDetailEditor with the full /pages/<id>
 * payload (PageDetail). Ported from gather's PageDrawer — zuko pages are
 * always standalone, so the entity "Source" row becomes a parent-page row.
 */
export const PageDrawer = ({ pageId }: PageDrawerProps) => {
  const {
    page,
    isLoading,
    isError,
    isSaving,
    lastSavedAt,
    handleSave,
    handleSaveStart,
    handleSaveComplete,
    handleSaveError,
  } = usePageDetailEditor(pageId);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading page...
        </div>
      </div>
    );
  }

  if (isError || !page) {
    return (
      <EmptyState
        title="Page not found"
        description="It may have been deleted, or you may not have access to it."
      />
    );
  }

  return (
    <div className="pb-16">
      {/* Sticky title row */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Heading level={1}>{formatPageTitle(page.title)}</Heading>
        <Link
          href={`/pages/${page.id}`}
          aria-label="Open page in full page"
          title="Open page in full page"
          className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <ArrowUpRightIcon className="size-5" />
        </Link>
      </div>

      <div className="space-y-6 py-6 pr-6 pl-8">
        {/* Parent page (tree via parentId) */}
        {page.parentId != null && (
          <div>
            <p className="mb-2 block text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              Parent page
            </p>
            <Link
              href={`/pages?id=${page.parentId}`}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <DocumentTextIcon className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span className="truncate">Open parent page</span>
            </Link>
          </div>
        )}

        {/* Page content */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
              Page
            </h2>
            <div className="flex items-center gap-2 text-xs">
              {isSaving && (
                <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                  <Spinner className="size-3" />
                  Saving...
                </span>
              )}
              {!isSaving && lastSavedAt && (
                <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                  Saved
                  <CheckIcon className="size-3" />
                </span>
              )}
            </div>
          </div>
          <WikiPage
            pageId={page.id}
            initialData={{
              blocks: page.blocks as never[],
              version: page.version,
            }}
            onSave={handleSave}
            placeholder="Write something important..."
            minHeight={200}
            onSaveStart={handleSaveStart}
            onSaveComplete={handleSaveComplete}
            onSaveError={handleSaveError}
          />
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800" />

        {/* Subpages */}
        <div>
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-300">
            Subpages
          </h2>
          {page.subpages.length === 0 ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              No subpages yet
            </div>
          ) : (
            <ul className="space-y-1.5">
              {page.subpages.map((sub) => (
                <li key={sub.id}>
                  <Link
                    href={`/pages?id=${sub.id}`}
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <DocumentTextIcon className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                    <span className="truncate">
                      {formatPageTitle(sub.title)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
