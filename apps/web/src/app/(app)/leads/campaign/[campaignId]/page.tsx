import { notFound } from 'next/navigation';
import LeadsInList from '@/components/Leads/LeadsInList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getLeadsInfinite } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

/**
 * Leads grouped by campaign. The group of leads that belong to no campaign —
 * a promoted prospect nobody sequenced — is addressed as `uncampaigned`
 * rather than by an id, since it has none.
 */
const UNCAMPAIGNED = 'uncampaigned';

interface Props {
  params: Promise<{ campaignId: string }>;
}

const LeadsInListPage = async ({ params }: Props) => {
  const { campaignId } = await params;
  const uncampaigned = campaignId === UNCAMPAIGNED;
  const id = uncampaigned ? undefined : parseInt(campaignId, 10);

  // Anything that is neither the group name nor a campaign id is a bad URL,
  // not an empty list.
  if (id !== undefined && Number.isNaN(id)) notFound();

  const filters = uncampaigned ? { uncampaigned: true } : { campaignId: id };

  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(getLeadsInfinite(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeadsInList campaignId={id} uncampaigned={uncampaigned} />
    </HydrationBoundary>
  );
};

export default LeadsInListPage;
