import TaskDetail from '@/components/Tasks/TaskDetail';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTask } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TaskDetail taskId={taskId} />
    </HydrationBoundary>
  );
};

export default TaskPage;
