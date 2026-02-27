import CompanyDetail from '@/components/Companies/CompanyDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getCompany } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface CompanyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CompanyPageProps) {
  const { id } = await params;
  const companyId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const company = await queryClient.fetchQuery(getCompany(companyId));

    return {
      title: company.companyName || 'Company',
    };
  } catch (error) {
    return {
      title: 'Company',
    };
  }
}

const CompanyPage = async ({ params }: CompanyPageProps) => {
  const { id } = await params;
  const companyId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getCompany(companyId));

  const session = await authClient.getSession({
    fetchOptions: { headers: Object.fromEntries((await headers()).entries()) },
  });
  const currentUserId = session?.data?.user?.id
    ? parseInt(session.data.user.id, 10)
    : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CompanyDetail companyId={companyId} currentUserId={currentUserId} />
    </HydrationBoundary>
  );
};

export default CompanyPage;
