import LeadDetail from '@/components/Leads/LeadDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getLead } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface LeadPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LeadPageProps) {
  const { id } = await params;
  const leadId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const lead = await queryClient.fetchQuery(getLead(leadId));
    return { title: lead.name || 'Lead' };
  } catch {
    return { title: 'Lead' };
  }
}

const LeadPage = async ({ params }: LeadPageProps) => {
  const { id } = await params;
  const leadId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getLead(leadId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LeadDetail leadId={leadId} />
    </HydrationBoundary>
  );
};

export default LeadPage;
