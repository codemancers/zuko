'use client';

import AccountForm from "@/components/Accounts/AccountForm";
import { Heading, Divider } from "@zuko/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { getAccount } from "@/server/query-options";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface EditAccountPageProps {
  params: Promise<{ id: string }>;
}

const EditAccountPage = ({ params }: EditAccountPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const accountId = parseInt(id, 10);
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push("/sign-in");
    }
  }, [session.isPending, session.data, router]);

  const { data: account, isLoading: accountLoading } = useQuery({
    ...getAccount(accountId),
    enabled: !!session.data,
  });

  if (session.isPending || !session.data || accountLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Account not found</div>
      </div>
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <>
      <Heading>Edit Account</Heading>
      <Divider className="mt-6" />
      <div className="mt-8 max-w-2xl">
        <AccountForm account={account} mode="edit" currentUserId={userId} />
      </div>
    </>
  );
};

export default EditAccountPage;
