'use client';

import { EmptyState, FormPageLayout, LoadingState } from '@/components/shared';
import ContactForm from '@/components/Contacts/ContactForm';
import { useQuery } from '@tanstack/react-query';
import { getContact } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';

interface EditContactPageProps {
  params: Promise<{ id: string }>;
}

const EditContactPage = ({ params }: EditContactPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const contactId = parseInt(id, 10);
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push('/sign-in');
    }
  }, [session.isPending, session.data, router]);

  const { data: contact, isLoading: contactLoading } = useQuery({
    ...getContact(contactId),
    enabled: !!session.data,
  });

  if (session.isPending || !session.data || contactLoading) {
    return <LoadingState />;
  }

  if (!contact) {
    return (
      <EmptyState
        title="Contact not found"
        description="It may have been deleted, or you may not have access to it."
      />
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <FormPageLayout title="Edit Contact">
      <ContactForm contact={contact} mode="edit" currentUserId={userId} />
    </FormPageLayout>
  );
};

export default EditContactPage;
