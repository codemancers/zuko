import LeadsInList from '@/components/Leads/LeadsInList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getLeads } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ campaignId: string }>;
}

const LeadsInListPage = async ({ params }: Props) => {
  const { campaignId } = await params;
  const id = parseInt(campaignId, 10);

  const queryClient = getQueryClient();
  if (!isNaN(id)) await queryClient.prefetchQuery(getLeads({ campaignId: id }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeadsInList campaignId={id} />
    </HydrationBoundary>
  );
};

export default LeadsInListPage;
