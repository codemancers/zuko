import CompaniesList from '@/components/Companies/CompaniesList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTableViewCompaniesInfinite } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Companies',
};

export const dynamic = 'force-dynamic';

const CompaniesPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery(
    getTableViewCompaniesInfinite({ search: undefined }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompaniesList />
    </HydrationBoundary>
  );
};

export default CompaniesPage;
