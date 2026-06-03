import CampaignDetail from '@/components/Campaigns/CampaignDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getCampaignById, getZukoCampaign } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  try {
    const queryClient = getQueryClient();
    const campaign = await queryClient.fetchQuery(getCampaignById(id));
    return { title: campaign.name || 'Campaign' };
  } catch {
    return { title: 'Campaign' };
  }
}

const CampaignDetailPage = async ({ params }: CampaignDetailPageProps) => {
  const { id } = await params;

  const queryClient = getQueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery(getCampaignById(id)),
    queryClient.prefetchQuery(getZukoCampaign(id)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignDetail sequenceId={id} />
    </HydrationBoundary>
  );
};

export default CampaignDetailPage;
