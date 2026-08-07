import LeadLists from '@/components/Leads/LeadLists';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getLeadLists } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = { title: 'Leads' };
export const dynamic = 'force-dynamic';

const LeadsPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getLeadLists());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeadLists />
    </HydrationBoundary>
  );
};

export default LeadsPage;
