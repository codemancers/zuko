'use client';

import { FormPageLayout, LoadingState } from '@/components/shared';
import CompanyForm from '@/components/Companies/CompanyForm';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const NewCompanyPage = () => {
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
    <FormPageLayout title="New Company">
      <CompanyForm mode="create" currentUserId={userId} />
    </FormPageLayout>
  );
};

export default NewCompanyPage;
