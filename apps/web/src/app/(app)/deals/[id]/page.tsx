import DealDetail from "@/components/Deals/DealDetail";
import { getQueryClient } from "@/lib/react-query/get-query-client";
import { getDeal } from "@/server/query-options";
import { authClient } from "@/lib/auth-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

interface DealPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DealPageProps) {
  const { id } = await params;
  const dealId = parseInt(id, 10);

  try {
    const queryClient = getQueryClient();
    const deal = await queryClient.fetchQuery(getDeal(dealId));

    return {
      title: deal.title || 'Deal',
    };
  } catch (error) {
    return {
      title: 'Deal',
    };
  }
}

const DealPage = async ({ params }: DealPageProps) => {
  const { id } = await params;
  const dealId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getDeal(dealId));

  const session = await authClient.getSession({
    fetchOptions: { headers: Object.fromEntries((await headers()).entries()) },
  });
  const currentUserId = session?.data?.user?.id
    ? parseInt(session.data.user.id, 10)
    : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DealDetail dealId={dealId} currentUserId={currentUserId} />
    </HydrationBoundary>
  );
};

export default DealPage;
