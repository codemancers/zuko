import TasksList from '@/components/Tasks/TasksList';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTasks } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const metadata = {
  title: 'Tasks',
};

export const dynamic = 'force-dynamic';

const TasksPage = async () => {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(getTasks());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksList />
    </HydrationBoundary>
  );
};

export default TasksPage;
