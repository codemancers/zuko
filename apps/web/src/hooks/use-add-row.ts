import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api/contacts';
import { companiesApi } from '@/lib/api/companies';
import { dealsApi } from '@/lib/api/deals';
import { toast } from 'sonner';

export type EntityType = 'contacts' | 'companies' | 'deals';
const entityNames = {
  contacts: 'Contact',
  companies: 'Company',
  deals: 'Deal',
};

export function useAddRow(entity: EntityType, totalCount = 0) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      switch (entity) {
        case 'contacts':
          return contactsApi.createContact({ name: 'New Contact' });
        case 'companies':
          return companiesApi.createCompany({ companyName: 'New Company' });
        case 'deals':
          return dealsApi.createDeal({ title: 'New Deal' });
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
