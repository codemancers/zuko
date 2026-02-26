'use client';

import ContactForm from '@/components/Contacts/ContactForm';
import { Heading, Divider } from '@zuko/ui-kit';
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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Contact not found
        </div>
      </div>
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <>
      <Heading>Edit Contact</Heading>
      <Divider className="mt-6" />
      <div className="mt-8 max-w-2xl">
        <ContactForm contact={contact} mode="edit" currentUserId={userId} />
      </div>
    </>
  );
};

export default EditContactPage;
