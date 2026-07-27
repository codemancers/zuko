import IcpChat from '@/components/Icp/IcpChat';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getIcpProfile } from '@/server/query-options';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const queryClient = getQueryClient();
    const profile = await queryClient.fetchQuery(
      getIcpProfile(parseInt(id, 10)),
    );
    return { title: `Edit ${profile.name}` };
  } catch {
    return { title: 'Edit ICP Profile' };
  }
}

export default async function EditIcpPage({ params }: Props) {
  const { id } = await params;
  const queryClient = getQueryClient();
  const profile = await queryClient
    .fetchQuery(getIcpProfile(parseInt(id, 10)))
    .catch(() => null);

  if (!profile)
    return <div className="p-8 text-zinc-400">Profile not found.</div>;

  return (
    <IcpChat
      profile={{ id: profile.id, name: profile.name, filters: profile.filters }}
    />
  );
}
