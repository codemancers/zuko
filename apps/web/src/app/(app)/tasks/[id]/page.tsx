import TaskDetail from '@/components/Tasks/TaskDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTask } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

interface TaskPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TaskPageProps) {
  const { id } = await params;
  try {
    const queryClient = getQueryClient();
    const task = await queryClient.fetchQuery(getTask(parseInt(id, 10)));
    return { title: task.title };
  } catch {
    return { title: 'Task' };
  }
}

const TaskPage = async ({ params }: TaskPageProps) => {
  const { id } = await params;
  const taskId = parseInt(id, 10);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getTask(taskId));

  const session = await authClient.getSession({
    fetchOptions: { headers: Object.fromEntries((await headers()).entries()) },
  });
  const currentUserId = session?.data?.user?.id
    ? parseInt(session.data.user.id, 10)
    : null;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TaskDetail taskId={taskId} currentUserId={currentUserId} />
    </HydrationBoundary>
  );
};

export default TaskPage;
