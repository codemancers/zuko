import React from 'react';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Metadata } from 'next';
import { MeetingList } from '@/components/meeting/meeting-list';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getMeetings } from '@/server/query-options';

export const metadata: Metadata = {
  title: 'Meetings | Zuko',
  description: 'Manage your meetings with Zuko',
};

export const dynamic = 'force-dynamic';

const MeetingsPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getMeetings);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MeetingList />
    </HydrationBoundary>
  );
};

export default MeetingsPage;
