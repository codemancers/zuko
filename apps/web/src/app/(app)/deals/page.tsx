import DealsList from '@/components/Deals/DealsList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTableViewDealsInfinite } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Deals',
};

export const dynamic = 'force-dynamic';

const DealsPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(
    getTableViewDealsInfinite({ search: undefined }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DealsList />
    </HydrationBoundary>
  );
};

export default DealsPage;
