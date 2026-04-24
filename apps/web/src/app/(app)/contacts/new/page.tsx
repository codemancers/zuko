'use client';

import ContactForm from '@/components/Contacts/ContactForm';
import { Heading, Divider } from '@zuko/ui-kit';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const NewContactPage = () => {
  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push('/sign-in');
    }
  }, [session.isPending, session.data, router]);

  if (session.isPending || !session.data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <>
      <Heading>New Contact</Heading>
      <Divider className="mt-6" />
      <div className="mt-8 max-w-2xl">
        <ContactForm mode="create" currentUserId={userId} />
      </div>
    </>
  );
};

export default NewContactPage;
