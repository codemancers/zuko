'use client';

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OutputData } from '@zuko/ui-kit';
import { getPage } from '@/server/query-options';
import { pagesApi, type EditorJsBlock } from '@/lib/api/pages';

/**
 * Shared editor state for a Page detail surface (full page or drawer).
 *
 * Owns the page fetch + save plumbing + the "Saved ✓" pulse. Layouts
 * (PageDetail, PageDrawer) call this hook and render whatever JSX they
 * want — the editing behavior lives here in one place. Ported from
 * gather's usePageDetailEditor; zuko pages are always standalone (no
 * entity-bound task/project pages), so saves always PATCH /pages/:id.
 */
export function usePageDetailEditor(pageId: number) {
  const queryClient = useQueryClient();

  // refetchOnWindowFocus:false — a background refetch while the user is
  // editing re-renders the detail surface (and historically tore down the
  // editor mid-edit).
  const {
    data: page,
    isLoading,
    error,
    isError,
  } = useQuery({
    ...getPage(pageId),
    refetchOnWindowFocus: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const handleSave = useCallback(
    async (data: OutputData) => {
      await pagesApi.updatePage(pageId, {
        blocks: (data.blocks ?? []) as EditorJsBlock[],
        version: data.version,
      });
      // Refresh ONLY the listing (exact key), never this page's own
      // ['pages', id] query — refetching that would remount the editor.
      await queryClient.invalidateQueries({
        queryKey: ['pages'],
        exact: true,
      });
    },
    [pageId, queryClient],
  );

  const handleSaveStart = useCallback(() => setIsSaving(true), []);
  const handleSaveComplete = useCallback(() => {
    setIsSaving(false);
    setLastSavedAt(new Date());
  }, []);
  const handleSaveError = useCallback(() => setIsSaving(false), []);

  return {
    page,
    isLoading,
    error,
    isError,
    isSaving,
    lastSavedAt,
    handleSave,
    handleSaveStart,
    handleSaveComplete,
    handleSaveError,
  };
}
