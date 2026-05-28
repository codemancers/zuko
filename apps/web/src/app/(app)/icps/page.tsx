import IcpList from '@/components/Icp/IcpList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getIcpProfiles } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'ICP Profiles',
};

export const dynamic = 'force-dynamic';

const IcpPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getIcpProfiles());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IcpList />
    </HydrationBoundary>
  );
};

export default IcpPage;
