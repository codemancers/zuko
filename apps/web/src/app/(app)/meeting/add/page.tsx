import React from 'react';
import type { Metadata } from 'next';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import AddMeeting from '@/components/meeting/add-meeting';

export const metadata: Metadata = {
  title: 'Create Meeting',
  description: 'Manage a new meeting with Zuko',
};

export const dynamic = 'force-dynamic';

const AddMeetingsPage = async () => {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AddMeeting />
    </HydrationBoundary>
  );
};

export default AddMeetingsPage;
