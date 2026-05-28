import IcpDetail from '@/components/Icp/IcpDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getIcpProfile } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface IcpDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: IcpDetailPageProps) {
  const { id } = await params;
  const profileId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const profile = await queryClient.fetchQuery(getIcpProfile(profileId));
    return { title: profile.name || 'ICP Profile' };
  } catch {
    return { title: 'ICP Profile' };
  }
}

const IcpDetailPage = async ({ params }: IcpDetailPageProps) => {
  const { id } = await params;
  const profileId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getIcpProfile(profileId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IcpDetail profileId={profileId} />
    </HydrationBoundary>
  );
};

export default IcpDetailPage;
