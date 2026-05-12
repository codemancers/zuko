import React from 'react';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MeetingList } from '@/components/meeting/meeting-list';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getMeetings } from '@/server/query-options';
import { meetingsFlag } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'Meetings | Zuko',
  description: 'Manage your meetings with Zuko',
};

export const dynamic = 'force-dynamic';

const MeetingsPage = async () => {
  const showMeetings = await meetingsFlag();
  if (!showMeetings) notFound();

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getMeetings);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MeetingList />
    </HydrationBoundary>
  );
};

export default MeetingsPage;
