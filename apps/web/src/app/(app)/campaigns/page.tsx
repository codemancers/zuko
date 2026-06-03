import CampaignsList from '@/components/Campaigns/CampaignsList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getCampaignsInfinite } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Campaigns',
};

export const dynamic = 'force-dynamic';

const CampaignsPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(getCampaignsInfinite());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignsList />
    </HydrationBoundary>
  );
};

export default CampaignsPage;
