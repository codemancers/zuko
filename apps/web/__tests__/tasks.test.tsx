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
import type { Task } from '@/lib/api/tasks';

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

  it('displays empty state when no tasks exist', async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
      expect(screen.getByText(/get started by creating a new task/i)).toBeInTheDocument();
    });
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
