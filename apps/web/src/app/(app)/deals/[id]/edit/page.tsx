'use client';

import DealForm from "@/components/Deals/DealForm";
import { Heading, Divider } from "@zuko/ui-kit";
import { useQuery } from "@tanstack/react-query";
import { getDeal } from "@/server/query-options";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

interface EditDealPageProps {
  params: Promise<{ id: string }>;
}

const EditDealPage = ({ params }: EditDealPageProps) => {
  const router = useRouter();
  const { id } = use(params);
  const dealId = parseInt(id, 10);
  const session = authClient.useSession();

  useEffect(() => {
    if (!session.isPending && !session.data) {
      router.push("/sign-in");
    }
  }, [session.isPending, session.data, router]);

  const { data: deal, isLoading: dealLoading } = useQuery({
    ...getDeal(dealId),
    enabled: !!session.data,
  });

  if (session.isPending || !session.data || dealLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Deal not found</div>
      </div>
    );
  }

  const userId = parseInt(session.data.user.id, 10);

  return (
    <>
      <Heading>Edit Deal</Heading>
      <Divider className="mt-6" />
      <div className="mt-8 max-w-2xl">
        <DealForm deal={deal} mode="edit" currentUserId={userId} />
      </div>
    </>
  );
};

export default EditDealPage;
