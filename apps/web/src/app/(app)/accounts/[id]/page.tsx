import AccountDetail from "@/components/Accounts/AccountDetail";
import { getQueryClient } from "@/lib/react-query/get-query-client";
import { getAccount } from "@/server/query-options";
import { authClient } from "@/lib/auth-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

interface AccountPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AccountPageProps) {
  const { id } = await params;
  const accountId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const account = await queryClient.fetchQuery(getAccount(accountId));

    return {
      title: account.companyName || 'Account',
    };
  } catch (error) {
    return {
      title: 'Account',
    };
  }
}

const AccountPage = async ({ params }: AccountPageProps) => {
  const { id } = await params;
  const accountId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getAccount(accountId));

  const session = await authClient.getSession({
    fetchOptions: { headers: Object.fromEntries((await headers()).entries()) },
  });
  const currentUserId = session?.data?.user?.id
    ? parseInt(session.data.user.id, 10)
    : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AccountDetail accountId={accountId} currentUserId={currentUserId} />
    </HydrationBoundary>
  );
};

export default AccountPage;
