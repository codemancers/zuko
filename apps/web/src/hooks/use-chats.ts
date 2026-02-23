import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Chat {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export const CHATS_QUERY_KEY = ['chats'];

export function useChats() {
  return useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: async (): Promise<Chat[]> => {
      const response = await fetch('/api/proxy/api/chats', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch chats');
      }

      const data = await response.json();
      return data.chats || [];
    },
  });
}

export function useInvalidateChats() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
  };
}
