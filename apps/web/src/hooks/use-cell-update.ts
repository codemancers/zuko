'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tablesApi } from '@/lib/api/tables';
import { toast } from 'sonner';

export function useCellUpdate(entity: string) {
  const queryClient = useQueryClient();

  const { mutate: updateCell, isPending } = useMutation({
    mutationFn: ({
      rowId,
      columnId,
      value,
    }: {
      rowId: string | number;
      columnId: string;
      value: unknown;
    }) => tablesApi.updateCell(entity, rowId, columnId, value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [entity] });
      queryClient.invalidateQueries({ queryKey: [entity, 'table'] });

      toast.success('Cell updated successfully');
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        toast.error(`Failed to update cell: ${error.message}`);
      } else {
        toast.error('Failed to update cell');
      }
    },
  });

  return {
    updateCell,
    isUpdating: isPending,
  };
}
