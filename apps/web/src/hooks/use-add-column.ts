import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateColumnDto } from '@/lib/api/tables';
import { tablesApi } from '@/lib/api/tables';
import { toast } from 'sonner';

export function useAddColumn(entity: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateColumnDto) => tablesApi.createColumn(entity, data),
    onSuccess: () => {
      toast.success('Column created successfully');
      queryClient.invalidateQueries({ queryKey: [entity, 'table'] });
    },
    onError: (error: any) => {
      const message =
        error.details?.message || error.message || 'Failed to create column';
      toast.error(message);
    },
  });
}
