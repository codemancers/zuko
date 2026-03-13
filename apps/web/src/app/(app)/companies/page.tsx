import CompaniesList from '@/components/Companies/CompaniesList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTableViewCompanies } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Companies',
};

export const dynamic = 'force-dynamic';

const CompaniesPage = async () => {
  const queryClient = getQueryClient();
  // Prefetch with undefined filters to match client's initial state
  await queryClient.prefetchQuery(getTableViewCompanies({ search: undefined }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompaniesList />
    </HydrationBoundary>
  );
};

export default CompaniesPage;
