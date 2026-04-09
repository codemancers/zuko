import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api/contacts';
import { companiesApi } from '@/lib/api/companies';
import { dealsApi } from '@/lib/api/deals';
import { tasksApi } from '@/lib/api/tasks';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';

export type EntityType = 'contacts' | 'companies' | 'deals' | 'tasks';
const entityNames = {
  contacts: 'contact',
  companies: 'company',
  deals: 'deal',
  tasks: 'task',
};

export function useAddRow(entity: EntityType) {
  const queryClient = useQueryClient();
  const session = authClient.useSession();

  const mutation = useMutation({
    mutationFn: async () => {
      const currentUserId = session.data?.user.id
        ? parseInt(session.data.user.id, 10)
        : undefined;

      switch (entity) {
        case 'contacts':
          return contactsApi.createContact({
            name: 'New Contact',
            ownerIds: currentUserId ? [currentUserId] : undefined,
            primaryOwnerId: currentUserId,
          });
        case 'companies':
          return companiesApi.createCompany({
            companyName: 'New Company',
            ownerIds: currentUserId ? [currentUserId] : undefined,
            primaryOwnerId: currentUserId,
          });
        case 'deals':
          return dealsApi.createDeal({
            title: 'New Deal',
            ownerIds: currentUserId ? [currentUserId] : undefined,
            primaryOwnerId: currentUserId,
          });
        case 'tasks':
          return tasksApi.createTask({ title: 'New Task' });
        default:
          throw new Error('Invalid entity type');
      }
    },
    onSuccess: () => {
      toast.success(`New ${entityNames[entity]} added`);
      queryClient.invalidateQueries({ queryKey: [entity] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add ${entityNames[entity]}: ${error.message}`);
    },
  });

  return {
    addRow: mutation.mutate,
    isAdding: mutation.isPending,
  };
}
