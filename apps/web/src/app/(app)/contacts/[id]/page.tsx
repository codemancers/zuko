import ContactDetail from '@/components/Contacts/ContactDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getContact } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface ContactPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ContactPageProps) {
  const { id } = await params;
  const contactId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const contact = await queryClient.fetchQuery(getContact(contactId));

    return {
      title: contact.name || 'Contact',
    };
  } catch (error) {
    return {
      title: 'Contact',
    };
  }
}

const ContactPage = async ({ params }: ContactPageProps) => {
  const { id } = await params;
  const contactId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getContact(contactId));

  const session = await authClient.getSession({
    fetchOptions: { headers: Object.fromEntries((await headers()).entries()) },
  });
  const currentUserId = session?.data?.user?.id
    ? parseInt(session.data.user.id, 10)
    : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContactDetail contactId={contactId} currentUserId={currentUserId} />
    </HydrationBoundary>
  );
};

export default ContactPage;
