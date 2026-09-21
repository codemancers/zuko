'use client';

import { FormPageLayout, LoadingState } from '@/components/shared';
import DealForm from '@/components/Deals/DealForm';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const NewDealPage = () => {
  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push('/sign-in');
    }
  }, [session.isPending, session.data, router]);

  if (session.isPending || !session.data) {
    return <LoadingState />;
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <FormPageLayout title="New Deal">
      <DealForm mode="create" currentUserId={userId} />
    </FormPageLayout>
  );
};

export default NewDealPage;
