import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useEndMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Placeholder: Replace with actual API call
      console.log('Ending meeting:', id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    },
  });
};

export const useDeleteMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Placeholder: Replace with actual API call
      console.log('Deleting meeting:', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
};
