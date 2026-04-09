/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TaskForm from '@/components/Tasks/TaskForm';
import TasksList from '@/components/Tasks/TasksList';
import TaskDetail from '@/components/Tasks/TaskDetail';
import { createTaskColumns } from '@/components/Tasks/columns';
import type { Task } from '@/lib/api/tasks';
import type { FlatTask } from '@/components/Tasks/columns';
import type { ColumnDef } from '@tanstack/react-table';

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockGetTasks = vi.fn();
const mockGetTask = vi.fn();
const mockDeleteTask = vi.fn();

vi.mock('@/lib/api/tasks', () => ({
  tasksApi: {
    createTask: (...args: unknown[]) => mockCreateTask(...args),
    updateTask: (...args: unknown[]) => mockUpdateTask(...args),
    getTasks: (...args: unknown[]) => mockGetTasks(...args),
    getTask: (...args: unknown[]) => mockGetTask(...args),
    deleteTask: (...args: unknown[]) => mockDeleteTask(...args),
  },
  TaskStatus: {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
    CANCELLED: 'CANCELLED',
  },
}));

// Mock ErrorMessage to avoid HeadlessUI context issues
vi.mock('@zuko/ui-kit', async () => {
  const actual = await vi.importActual('@zuko/ui-kit');
  return {
    ...actual,
    ErrorMessage: ({ children }: { children: React.ReactNode }) => (
      <div role="alert">{children}</div>
    ),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

const mockTask: Task = {
  id: 1,
  organizationId: 1,
  title: 'Test Task',
  description: 'Test description',
  status: 'TODO',
  completedAt: null,
  parentId: null,
  assignee: 'john@example.com',
  subtasks: [],
  owners: [],
  createdAt: '2026-03-12T00:00:00Z',
  updatedAt: '2026-03-12T00:00:00Z',
};

describe('TaskForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTasks.mockResolvedValue({
      tasks: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  it('renders form with all required fields', () => {
    render(<TaskForm mode="create" />, { wrapper });

    expect(screen.getByLabelText(/title \*/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/optional description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
  });

  it('creates a task successfully', async () => {
    const user = userEvent.setup();
    mockCreateTask.mockResolvedValue(mockTask);

    render(<TaskForm mode="create" />, { wrapper });

    await user.type(screen.getByLabelText(/title \*/i), 'New Task');
    await user.type(screen.getByPlaceholderText(/optional description/i), 'Description');
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Task' })
      );
      expect(mockPush).toHaveBeenCalledWith('/tasks');
    });
  });

  it('creates a subtask with parent ID', async () => {
    const user = userEvent.setup();
    mockCreateTask.mockResolvedValue({ ...mockTask, parentId: 5 });
    mockGetTasks.mockResolvedValue({
      tasks: [{ id: 5, title: 'Parent Task', subtasks: [] }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(<TaskForm mode="create" defaultParentId={5} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText(/parent task/i)).toHaveValue('5');
    });

    await user.type(screen.getByLabelText(/title \*/i), 'Subtask');
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Subtask', parentId: 5 })
      );
    });
  });

  it('updates a task in edit mode', async () => {
    const user = userEvent.setup();
    mockUpdateTask.mockResolvedValue({ ...mockTask, title: 'Updated' });

    render(<TaskForm mode="edit" task={mockTask} />, { wrapper });

    const titleInput = screen.getByLabelText(/title \*/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Updated' }));
      expect(mockPush).toHaveBeenCalledWith('/tasks/1');
    });
  });

  it('displays error message on submission failure', async () => {
    const user = userEvent.setup();
    mockCreateTask.mockRejectedValue(new Error('Network error'));

    render(<TaskForm mode="create" />, { wrapper });

    await user.type(screen.getByLabelText(/title \*/i), 'New Task');
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    }, { timeout: 3000 });
  });
});

describe('TasksList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays empty table when no tasks exist', async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      // Headers should still be there
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Subtasks')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Assignee')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Created By')).toBeInTheDocument();
      expect(screen.getByText('Completed At')).toBeInTheDocument();
    });
    
    // The table body should have no data rows
    const tbody = screen.getByRole('table').querySelector('tbody');
    expect(tbody?.children.length).toBe(0);

    // button with add row label should be present
    expect(screen.getByRole('button', { name: /add row/i })).toBeInTheDocument();
  });

  it('displays tasks with subtasks in table', async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [
        {
          ...mockTask,
          subtasks: [
            {
              id: 2,
              organizationId: 1,
              title: 'Subtask 1',
              description: null,
              status: 'TODO',
              completedAt: null,
              parentId: 1,
              assignee: null,
              subtasks: [],
              createdAt: '2026-03-12T00:00:00Z',
              updatedAt: '2026-03-12T00:00:00Z',
            },
          ],
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByText('Test Task').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Subtask 1').length).toBeGreaterThan(0);
    });
  });

  it('navigates to task detail when row is clicked', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      tasks: [mockTask],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByText('Test Task')[0]).toBeInTheDocument();
    });

    const rows = screen.getAllByRole('row');
    const dataRow = rows.find((row) => row.textContent?.includes('Test Task'));
    if (dataRow) {
      await user.click(dataRow);
      expect(mockPush).toHaveBeenCalledWith('/tasks/1');
    }
  });
});

describe('TaskDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task detail with all information', async () => {
    mockGetTask.mockResolvedValue(mockTask);

    render(<TaskDetail taskId={1} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText(/john@example\.com/i)).toBeInTheDocument();
    });
  });

  it('displays subtasks section', async () => {
    mockGetTask.mockResolvedValue({
      ...mockTask,
      subtasks: [
        {
          id: 2,
          organizationId: 1,
          title: 'Subtask 1',
          description: null,
          status: 'TODO',
          completedAt: null,
          parentId: 1,
          assignee: null,
          subtasks: [],
          createdAt: '2026-03-12T00:00:00Z',
          updatedAt: '2026-03-12T00:00:00Z',
        },
      ],
    });

    render(<TaskDetail taskId={1} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/subtasks/i)).toBeInTheDocument();
      expect(screen.getByText('Subtask 1')).toBeInTheDocument();
    });
  });

  it('navigates to edit page when edit is clicked', async () => {
    const user = userEvent.setup();
    mockGetTask.mockResolvedValue(mockTask);

    render(<TaskDetail taskId={1} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockPush).toHaveBeenCalledWith('/tasks/1/edit');
  });

  it('shows delete confirmation dialog and deletes task', async () => {
    const user = userEvent.setup();
    mockGetTask.mockResolvedValue(mockTask);
    mockDeleteTask.mockResolvedValue(undefined);

    render(<TaskDetail taskId={1} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText(/delete task/i)).toBeInTheDocument();
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith(1);
      expect(mockPush).toHaveBeenCalledWith('/tasks');
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: render a single column's cell given a FlatTask
// ---------------------------------------------------------------------------
type CellArgs = { row: { original: FlatTask }; getValue: () => unknown };

function renderCell(columns: ColumnDef<FlatTask>[], colId: string, task: FlatTask) {
  const col = columns.find(
    (c) => (c as { id?: string; accessorKey?: string }).id === colId ||
            (c as { id?: string; accessorKey?: string }).accessorKey === colId
  ) as (ColumnDef<FlatTask> & { cell?: (args: CellArgs) => React.ReactNode }) | undefined;

  if (!col?.cell) throw new Error(`Column "${colId}" not found or has no cell renderer`);

  const args: CellArgs = {
    row: { original: task },
    getValue: () => (task as unknown as Record<string, unknown>)[colId],
  };

  const Cell = () => <>{col.cell!(args)}</>;
  return render(<Cell />);
}

const baseTask: FlatTask = {
  id: 42,
  organizationId: 1,
  title: 'Column Test Task',
  description: 'desc',
  status: 'TODO',
  completedAt: null,
  parentId: null,
  assignee: 'alice@example.com',
  owners: [
    {
      isPrimary: true,
      user: {
        id: 1,
        name: 'bob@example.com',
        email: 'bob@example.com',
      },
    },
  ] as any,
  subtasks: [],
  createdAt: '2026-03-12T00:00:00Z',
  updatedAt: '2026-03-12T00:00:00Z',
};

describe('createTaskColumns', () => {
  const onUpdate = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onComplete = vi.fn();
  let columns: ColumnDef<FlatTask>[];

  beforeEach(() => {
    vi.clearAllMocks();
    columns = createTaskColumns({ onUpdate, onEdit, onDelete, onComplete });
  });

  it('returns 8 columns', () => {
    expect(columns).toHaveLength(8);
  });

  describe('ID column', () => {
    it('renders the task id', () => {
      renderCell(columns, 'id', baseTask);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('copies id to clipboard and shows "Copied" feedback on click', async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });

      renderCell(columns, 'id', baseTask);

      await user.click(screen.getByText('42'));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('42');
        expect(screen.getByText(/copied/i)).toBeInTheDocument();
      });
    });
  });

  describe('Title column', () => {
    it('renders the task title', () => {
      renderCell(columns, 'title', baseTask);
      expect(screen.getByText('Column Test Task')).toBeInTheDocument();
    });

    it('does not render parentTitle label for top-level tasks', () => {
      renderCell(columns, 'title', baseTask);
      expect(screen.queryByText(/subtask of/i)).not.toBeInTheDocument();
    });
  });

  describe('Subtasks column', () => {
    it('renders "—" for a subtask row (has parentTitle)', () => {
      const subtask: FlatTask = { ...baseTask, parentTitle: 'Parent Task' };
      renderCell(columns, 'subtasks', subtask);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders "—" when a top-level task has no subtasks', () => {
      renderCell(columns, 'subtasks', { ...baseTask, subtasks: [] });
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders singular badge for 1 subtask', () => {
      const task: FlatTask = { ...baseTask, subtasks: [{ ...baseTask, id: 99 }] };
      renderCell(columns, 'subtasks', task);
      expect(screen.getByText('1 subtask')).toBeInTheDocument();
    });

    it('renders plural badge for multiple subtasks', () => {
      const task: FlatTask = {
        ...baseTask,
        subtasks: [{ ...baseTask, id: 99 }, { ...baseTask, id: 100 }],
      };
      renderCell(columns, 'subtasks', task);
      expect(screen.getByText('2 subtasks')).toBeInTheDocument();
    });
  });

  describe('Status column', () => {
    it.each([
      ['TODO', 'To Do'],
      ['IN_PROGRESS', 'In Progress'],
      ['DONE', 'Done'],
      ['CANCELLED', 'Cancelled'],
    ] as const)('renders label "%s" for status %s', (status, label) => {
      renderCell(columns, 'status', { ...baseTask, status });
      // The label appears in both the Badge and the <option> — verify at least one is present
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });

    it('calls onUpdate with new status when select changes', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'status', { ...baseTask, status: 'TODO' });

      await user.selectOptions(
        screen.getByRole('combobox'),
        'IN_PROGRESS'
      );

      expect(onUpdate).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'IN_PROGRESS' }));
    });

    it('includes completedAt when changing to DONE', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'status', { ...baseTask, status: 'TODO' });

      await user.selectOptions(screen.getByRole('combobox'), 'DONE');

      expect(onUpdate).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ status: 'DONE', completedAt: expect.any(String) })
      );
    });

    it('clears completedAt when changing away from DONE', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'status', {
        ...baseTask,
        status: 'DONE',
        completedAt: '2026-03-12T00:00:00Z',
      });

      await user.selectOptions(screen.getByRole('combobox'), 'TODO');

      expect(onUpdate).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ status: 'TODO', completedAt: null })
      );
    });
  });

  describe('Assignee column', () => {
    it('renders the assignee name', () => {
      renderCell(columns, 'assignee', baseTask);
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('renders "Unassigned" when assignee is null', () => {
      renderCell(columns, 'assignee', { ...baseTask, assignee: null });
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('switches to input on click', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'assignee', baseTask);

      await user.click(screen.getByText('alice@example.com'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('calls onUpdate with new value on blur', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'assignee', baseTask);

      await user.click(screen.getByText('alice@example.com'));
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'carol@example.com');
      await user.tab(); // blur

      expect(onUpdate).toHaveBeenCalledWith(42, { assignee: 'carol@example.com' });
    });

    it('commits on Enter key', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'assignee', { ...baseTask, assignee: null });

      await user.click(screen.getByText('Unassigned'));
      await user.type(screen.getByRole('textbox'), 'new@example.com');
      await user.keyboard('{Enter}');

      expect(onUpdate).toHaveBeenCalledWith(42, { assignee: 'new@example.com' });
    });

    it('reverts to display mode on Escape without calling onUpdate', async () => {
      const user = userEvent.setup();
      renderCell(columns, 'assignee', baseTask);

      await user.click(screen.getByText('alice@example.com'));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Created By column', () => {
    it('renders the primary owner name', () => {
      renderCell(columns, 'owners', baseTask);
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });

    it('renders "—" when there is no primary owner', () => {
      renderCell(columns, 'owners', { ...baseTask, owners: [] } as any);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Completed At column', () => {
    it('renders "—" when completedAt is null', () => {
      renderCell(columns, 'completedAt', baseTask);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders formatted date when completedAt is set', () => {
      renderCell(columns, 'completedAt', {
        ...baseTask,
        completedAt: '2026-03-12T00:00:00Z',
      });
      expect(screen.getByText('Mar 12, 2026')).toBeInTheDocument();
    });
  });

  describe('Actions column', () => {
    it('renders the actions icon buttons', () => {
      const col = columns.find(
        (c) => (c as { id?: string }).id === 'actions'
      ) as ColumnDef<FlatTask> & { cell: (args: CellArgs) => React.ReactNode };

      const Cell = () => (
        <>
          {col.cell({ row: { original: baseTask }, getValue: () => undefined })}
        </>
      );
      render(<Cell />);

      expect(screen.getByLabelText(/edit task/i)).toBeInTheDocument();
    });

    it('calls onEdit when Edit is clicked', async () => {
      const user = userEvent.setup();
      const col = columns.find(
        (c) => (c as { id?: string }).id === 'actions'
      ) as ColumnDef<FlatTask> & { cell: (args: CellArgs) => React.ReactNode };

      const Cell = () => (
        <>
          {col.cell({ row: { original: baseTask }, getValue: () => undefined })}
        </>
      );
      render(<Cell />);

      await user.click(screen.getByLabelText(/edit task/i));

      expect(onEdit).toHaveBeenCalledWith(baseTask);
    });

    it('calls onDelete when Delete is clicked', async () => {
      const user = userEvent.setup();
      const col = columns.find(
        (c) => (c as { id?: string }).id === 'actions'
      ) as ColumnDef<FlatTask> & { cell: (args: CellArgs) => React.ReactNode };

      const Cell = () => (
        <>
          {col.cell({ row: { original: baseTask }, getValue: () => undefined })}
        </>
      );
      render(<Cell />);

      await user.click(screen.getByLabelText(/delete task/i));

      expect(onDelete).toHaveBeenCalledWith(baseTask);
    });

    it('calls onComplete when Complete is clicked for non-done tasks', async () => {
      const user = userEvent.setup();
      const col = columns.find(
        (c) => (c as { id?: string }).id === 'actions'
      ) as ColumnDef<FlatTask> & { cell: (args: CellArgs) => React.ReactNode };

      const Cell = () => (
        <>
          {col.cell({ row: { original: baseTask }, getValue: () => undefined })}
        </>
      );
      render(<Cell />);

      await user.click(screen.getByLabelText(/mark complete/i));

      expect(onComplete).toHaveBeenCalledWith(baseTask);
    });

    it('does not render Complete for tasks with status DONE', async () => {
      const col = columns.find(
        (c) => (c as { id?: string }).id === 'actions'
      ) as ColumnDef<FlatTask> & { cell: (args: CellArgs) => React.ReactNode };

      const doneTask: FlatTask = { ...baseTask, status: 'DONE' };
      const Cell = () => (
        <>
          {col.cell({ row: { original: doneTask }, getValue: () => undefined })}
        </>
      );
      render(<Cell />);

      expect(screen.queryByLabelText(/mark complete/i)).not.toBeInTheDocument();
    });
  });
});
