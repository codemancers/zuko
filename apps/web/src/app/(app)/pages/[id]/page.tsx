import PageDetail from '@/components/Pages/PageDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getPage } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface PageDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageDetailPageProps) {
  const { id } = await params;
  try {
    const queryClient = getQueryClient();
    const page = await queryClient.fetchQuery(getPage(parseInt(id, 10)));
    return { title: page.title || 'Untitled page' };
  } catch {
    return { title: 'Page' };
  }
}

const PageDetailPage = async ({ params }: PageDetailPageProps) => {
  const { id } = await params;
  const pageId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getPage(pageId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PageDetail pageId={pageId} />
    </HydrationBoundary>
  );
};

export default PageDetailPage;
