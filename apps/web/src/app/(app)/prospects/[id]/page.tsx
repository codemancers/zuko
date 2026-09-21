import ProspectDetail from '@/components/Prospects/ProspectDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getProspect, getProspectEvents } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface ProspectPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProspectPageProps) {
  const { id } = await params;
  const prospectId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const prospect = await queryClient.fetchQuery(getProspect(prospectId));
    return { title: prospect.name || 'Prospect' };
  } catch {
    return { title: 'Prospect' };
  }
}

const ProspectPage = async ({ params }: ProspectPageProps) => {
  const { id } = await params;
  const prospectId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(getProspect(prospectId)),
    queryClient.prefetchQuery(getProspectEvents(prospectId)),
  ]);

  const session = await authClient.getSession({
    fetchOptions: { headers: Object.fromEntries((await headers()).entries()) },
  });
  const currentUserId = session?.data?.user?.id
    ? parseInt(session.data.user.id, 10)
    : undefined;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProspectDetail prospectId={prospectId} currentUserId={currentUserId} />
    </HydrationBoundary>
  );
};

export default ProspectPage;
