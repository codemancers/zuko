import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import MeetingDetail from '@/components/meeting/meeting-detail';

interface MeetingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    return {
      title: 'Meeting | GatherAI',
      description: 'View and manage scheduled meetings on GatherAI',
    };
  } catch {
    return {
      title: 'Meeting | GatherAI',
      description: 'Review or participate in a meeting on GatherAI',
    };
  }
}

const MeetingPage = async ({ params }: MeetingPageProps) => {
  const { id } = await params;
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MeetingDetail meetingId={id} />
    </HydrationBoundary>
  );
};

export default MeetingPage;
