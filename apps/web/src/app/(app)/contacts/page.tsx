import ContactsList from '@/components/Contacts/ContactsList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTableViewContactsInfinite } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Contacts',
};

export const dynamic = 'force-dynamic';

const ContactsPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(
    getTableViewContactsInfinite({ search: undefined }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContactsList />
    </HydrationBoundary>
  );
};

export default ContactsPage;
