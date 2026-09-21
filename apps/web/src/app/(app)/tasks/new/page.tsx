'use client';

import { FormPageLayout } from '@/components/shared';
import TaskForm from '@/components/Tasks/TaskForm';
import { useSearchParams } from 'next/navigation';

const NewTaskPage = () => {
  const searchParams = useSearchParams();
  const parentId = searchParams.get('parentId');

  return (
    <FormPageLayout title={parentId ? 'New Subtask' : 'New Task'}>
      <TaskForm
        mode="create"
        defaultParentId={parentId ? parseInt(parentId, 10) : undefined}
      />
    </FormPageLayout>
  );
};

export default NewTaskPage;
