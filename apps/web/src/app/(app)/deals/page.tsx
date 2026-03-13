import DealsList from '@/components/Deals/DealsList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTableViewDeals } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Deals',
};

export const dynamic = 'force-dynamic';

const DealsPage = async () => {
  const queryClient = getQueryClient();
  // Prefetch with undefined filters to match client's initial state
  await queryClient.prefetchQuery(getTableViewDeals({ search: undefined }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DealsList />
    </HydrationBoundary>
  );
};

export default DealsPage;
