import PagesList from '@/components/Pages/PagesList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getPages } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Pages',
};

export const dynamic = 'force-dynamic';

const PagesPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getPages);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PagesList />
    </HydrationBoundary>
  );
};

export default PagesPage;
