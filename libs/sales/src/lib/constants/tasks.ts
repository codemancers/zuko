export const TASK_STATUSES = [
  { label: 'To Do', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
  { label: 'Cancelled', value: 'CANCELLED' },
] as const;

export const TASK_STATUS_VALUES: string[] = TASK_STATUSES.map(
  (s) => s.value as string,
);
