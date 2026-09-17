import ProspectsList from '@/components/Prospects/ProspectsList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getProspects, getProspectStats } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = { title: 'Prospects' };
export const dynamic = 'force-dynamic';

const ProspectsPage = async () => {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(getProspects({})),
    queryClient.prefetchQuery(getProspectStats()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProspectsList />
    </HydrationBoundary>
  );
};

export default ProspectsPage;
