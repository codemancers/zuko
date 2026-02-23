import AccountsList from "@/components/Accounts/AccountsList";
import { getQueryClient } from "@/lib/react-query/get-query-client";
import { getAccounts } from "@/server/query-options";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export const metadata = {
  title: 'Accounts',
};

export const dynamic = "force-dynamic";

const AccountsPage = async () => {
  const queryClient = getQueryClient();
  // Prefetch with undefined filters to match client's initial state
  await queryClient.prefetchQuery(getAccounts({ search: undefined }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AccountsList />
    </HydrationBoundary>
  );
};

export default AccountsPage;
