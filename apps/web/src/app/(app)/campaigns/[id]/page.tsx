import CampaignDetail from '@/components/Campaigns/CampaignDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getZukoCampaignByDbId } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CampaignDetailPageProps) {
  const { id } = await params;
  try {
    const queryClient = getQueryClient();
    const campaign = await queryClient.fetchQuery(
      getZukoCampaignByDbId(parseInt(id, 10)),
    );
    return { title: campaign.name || 'Campaign' };
  } catch {
    return { title: 'Campaign' };
  }
}

const CampaignDetailPage = async ({ params }: CampaignDetailPageProps) => {
  const { id } = await params;
  const zukoId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getZukoCampaignByDbId(zukoId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignDetail zukoId={zukoId} />
    </HydrationBoundary>
  );
};

export default CampaignDetailPage;
