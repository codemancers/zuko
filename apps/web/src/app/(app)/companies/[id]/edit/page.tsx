'use client';

import { EmptyState, FormPageLayout, LoadingState } from '@/components/shared';
import CompanyForm from '@/components/Companies/CompanyForm';
import { useQuery } from '@tanstack/react-query';
import { getCompany } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';

interface EditCompanyPageProps {
  params: Promise<{ id: string }>;
}

const EditCompanyPage = ({ params }: EditCompanyPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const companyId = parseInt(id, 10);
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push('/sign-in');
    }
  }, [session.isPending, session.data, router]);

  const { data: company, isLoading: companyLoading } = useQuery({
    ...getCompany(companyId),
    enabled: !!session.data,
  });

  if (session.isPending || !session.data || companyLoading) {
    return <LoadingState />;
  }

  if (!company) {
    return (
      <EmptyState
        title="Company not found"
        description="It may have been deleted, or you may not have access to it."
      />
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <FormPageLayout title="Edit Company">
      <CompanyForm company={company} mode="edit" currentUserId={userId} />
    </FormPageLayout>
  );
};

export default EditCompanyPage;
