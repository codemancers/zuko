import { ListOrg } from '@/components/organization/list-org';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getOrganizations } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';

export const metadata = {
  title: 'Organizations',
};

export const dynamic = 'force-dynamic';

const OrganizationIndexPage = async () => {
  const queryClient = getQueryClient();
  const requestHeaders = await headers();

  // Prefetch organizations with server headers to fix the null response issue
  await queryClient.prefetchQuery(
    getOrganizations(Object.fromEntries(requestHeaders.entries())),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListOrg />
    </HydrationBoundary>
  );
};

export default OrganizationIndexPage;
