import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import MeetingDetail from '@/components/meeting/meeting-detail';
import { getMeeting } from '@/server/query-options';
import { meetingsFlag } from '@/lib/flags';

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
  const showMeetings = await meetingsFlag();
  if (!showMeetings) notFound();

  const { id } = await params;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getMeeting(parseInt(id, 10)));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MeetingDetail meetingId={id} />
    </HydrationBoundary>
  );
};

export default MeetingPage;
