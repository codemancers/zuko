'use client';

import { EmptyState, FormPageLayout, LoadingState } from '@/components/shared';
import DealForm from '@/components/Deals/DealForm';
import { useQuery } from '@tanstack/react-query';
import { getDeal } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';

interface EditDealPageProps {
  params: Promise<{ id: string }>;
}

const EditDealPage = ({ params }: EditDealPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const dealId = parseInt(id, 10);
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push('/sign-in');
    }
  }, [session.isPending, session.data, router]);

  const { data: deal, isLoading: dealLoading } = useQuery({
    ...getDeal(dealId),
    enabled: !!session.data,
  });

  if (session.isPending || !session.data || dealLoading) {
    return <LoadingState />;
  }

  if (!deal) {
    return (
      <EmptyState
        title="Deal not found"
        description="It may have been deleted, or you may not have access to it."
      />
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <FormPageLayout title="Edit Deal">
      <DealForm deal={deal} mode="edit" currentUserId={userId} />
    </FormPageLayout>
  );
};

export default EditDealPage;
