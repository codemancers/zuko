import CampaignForm from '@/components/Campaigns/CampaignForm';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getZukoCampaign } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface EditCampaignPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditCampaignPageProps) {
  const { id } = await params;
  try {
    const queryClient = getQueryClient();
    const campaign = await queryClient.fetchQuery(getZukoCampaign(id));
    return { title: `Edit – ${campaign.name}` };
  } catch {
    return { title: 'Edit Campaign' };
  }
}

const EditCampaignPage = async ({ params }: EditCampaignPageProps) => {
  const { id } = await params;

  const queryClient = getQueryClient();
  try {
    await queryClient.fetchQuery(getZukoCampaign(id));
  } catch {
    notFound();
  }

  const campaign = queryClient.getQueryData(getZukoCampaign(id).queryKey);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignForm mode="edit" campaign={campaign} />
    </HydrationBoundary>
  );
};

export default EditCampaignPage;
