'use client';

import { ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Divider, Heading, Button } from '@zuko/ui-kit';
import { useQuery } from '@tanstack/react-query';
import { getTasks } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { taskColumns } from './columns';
import { BaseTable } from '../Table';

const TasksList = () => {
  const router = useRouter();
  const { data, isLoading } = useQuery(getTasks());

  const tasks = data?.tasks ?? [];

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Tasks</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage and track your team's work
          </p>
        </div>
        <Button onClick={() => router.push('/tasks/new')}>
          <PlusIcon className="h-4 w-4" />
          New Task
        </Button>
      </div>

      <Divider className="mt-6" />

      <BaseTable
        columns={taskColumns}
        data={tasks}
        loading={isLoading}
        onRowClick={(task) => router.push(`/tasks/${task.id}`)}
        totalCount={data?.pagination?.total}
        entityName="tasks"
        emptyStateConfig={{
          icon: ClipboardDocumentListIcon,
          title: 'No Tasks',
          description: 'Get started by creating a new task.',
          action: {
            label: 'New Task',
            onClick: () => router.push('/tasks/new'),
          },
        }}
      />
    </>
  );
};

export default TasksList;
