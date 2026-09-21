import { FormPageLayout } from '@/components/shared/FormPageLayout';
import TaskForm from '@/components/Tasks/TaskForm';
import { getQueryClient } from '@/lib/react-query/get-query-client';
import { getTask } from '@/server/query-options';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

export const dynamic = 'force-dynamic';

interface EditTaskPageProps {
  params: Promise<{ id: string }>;
}

const EditTaskPageInner = async ({ taskId }: { taskId: number }) => {
  const queryClient = getQueryClient();
  const task = await queryClient.fetchQuery(getTask(taskId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FormPageLayout title="Edit Task">
        <TaskForm mode="edit" task={task} />
      </FormPageLayout>
    </HydrationBoundary>
  );
};

const EditTaskPage = async ({ params }: EditTaskPageProps) => {
  const { id } = await params;
  return <EditTaskPageInner taskId={parseInt(id, 10)} />;
};

export default EditTaskPage;
