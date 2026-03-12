'use client';

import TaskForm from '@/components/Tasks/TaskForm';
import { Heading, Divider } from '@zuko/ui-kit';
import { useSearchParams } from 'next/navigation';

const NewTaskPage = () => {
  const searchParams = useSearchParams();
  const parentId = searchParams.get('parentId');

  return (
    <>
      <Heading>{parentId ? 'New Subtask' : 'New Task'}</Heading>
      <Divider className="mt-6" />
      <div className="mt-8 max-w-2xl">
        <TaskForm
          mode="create"
          defaultParentId={parentId ? parseInt(parentId, 10) : undefined}
        />
      </div>
    </>
  );
};

export default NewTaskPage;
