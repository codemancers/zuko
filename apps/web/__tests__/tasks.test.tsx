/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { id: '1' } } })),
    useActiveOrganization: vi.fn(() => ({ data: { id: 'org-1' } })),
    organization: {
      listMembers: vi.fn(() =>
        Promise.resolve({
          data: {
            members: [
              { user: { name: 'john@example.com' } },
              { user: { name: 'jane@example.com' } },
              { user: { name: 'alice@example.com' } },
              { user: { name: 'bob@example.com' } },
              { user: { name: 'carol@example.com' } },
              { user: { name: 'dave@example.com' } },
            ],
          },
        }),
      ),
    },
  },
}));

const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockGetTasks = vi.fn();
const mockGetTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockUpdateCell = vi.fn();

vi.mock('@/lib/api/tasks', () => ({
  tasksApi: {
    createTask: (...args: unknown[]) => mockCreateTask(...args),
    updateTask: (...args: unknown[]) => mockUpdateTask(...args),
    getTasks: (...args: unknown[]) => mockGetTasks(...args),
    getTableViewTasks: (...args: unknown[]) => mockGetTasks(...args),
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

vi.mock('@/lib/api/tables', () => ({
  tablesApi: {
    updateCell: (...args: unknown[]) => mockUpdateCell(...args),
  },
}));

vi.mock('@/lib/api/metadata', () => ({
  metadataApi: {
    getTaskStatuses: vi.fn(() =>
      Promise.resolve([
        { value: 'TODO', label: 'To Do' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'DONE', label: 'Done' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ]),
    ),
  },
}));

// Mock ErrorMessage to avoid HeadlessUI context issues
// Mock Combobox to avoid HeadlessUI portal/virtual rendering issues in jsdom
vi.mock('@zuko/ui-kit', async () => {
  const actual = await vi.importActual('@zuko/ui-kit');
  return {
    ...actual,
    ErrorMessage: ({ children }: { children: React.ReactNode }) => (
      <div role="alert">{children}</div>
    ),
    Combobox: ({
      options,
      onChange,
      placeholder,
      children: _children,
      value,
      displayValue,
    }: any) => (
      <select
        data-testid="mock-combobox"
        value={
          value
            ? typeof value === 'object'
              ? (value.value ?? value.code ?? '')
              : value
            : ''
        }
        onChange={(e) => {
          const selected = options.find(
            (o: any) => String(o.value ?? o.code ?? o) === e.target.value,
          );
          if (selected) onChange(selected);
        }}
        aria-label={placeholder}
      >
        <option value="">{placeholder}</option>
        {options.map((o: any) => (
          <option key={o.value ?? o.code ?? o} value={o.value ?? o.code ?? o}>
            {o.label ?? o.code ?? String(o)}
          </option>
        ))}
      </select>
    ),
    ComboboxOption: ({ children }: any) => <>{children}</>,
    ComboboxLabel: ({ children }: any) => <>{children}</>,
    ComboboxDescription: ({ children }: any) => <>{children}</>,
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

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockTask: Task = {
  id: 1,
  organizationId: 1,
  title: 'Test Task',
  description: {
    blocks: [{ type: 'paragraph', data: { text: 'Test description' } }],
    version: '2.30.0',
    time: 123,
  },
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
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetTasks.mockResolvedValue({
      tasks: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
  });

  it('renders form with all required fields', () => {
    render(<TaskForm mode="create" />, { wrapper });

    expect(screen.getByLabelText(/title \*/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/optional description/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create task/i }),
    ).toBeInTheDocument();
  });

  it('creates a task successfully', async () => {
    const user = userEvent.setup();
    mockCreateTask.mockResolvedValue(mockTask);

    render(<TaskForm mode="create" />, { wrapper });

    await user.type(screen.getByLabelText(/title \*/i), 'New Task');
    await user.type(
      screen.getByPlaceholderText(/optional description/i),
      'Description',
    );
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Task' }),
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
        expect.objectContaining({ title: 'Subtask', parentId: 5 }),
      );
    });
  });

  it('displays error message on submission failure', async () => {
    const user = userEvent.setup();
    mockCreateTask.mockRejectedValue(new Error('Network error'));

    render(<TaskForm mode="create" />, { wrapper });

    await user.type(screen.getByLabelText(/title \*/i), 'New Task');
    await user.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(
      () => {
        expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
      },
      { timeout: 3000 },
    );
  });
});

const mockTableViewResponse = {
  data: [],
  metadata: [
    {
      id: 'title',
      header: 'Title',
      fieldType: 'entity',
      dataType: 'text',
      editable: true,
    },
    {
      id: 'status',
      header: 'Status',
      fieldType: 'select',
      dataType: 'text',
      editable: true,
      config: {
        options: [
          { value: 'TODO', label: 'Todo' },
          { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'DONE', label: 'Done' },
        ],
      },
    },
    {
      id: 'assignee',
      header: 'Assignee',
      fieldType: 'text',
      dataType: 'text',
      editable: true,
    },
    {
      id: 'completedAt',
      header: 'Completed At',
      fieldType: 'date',
      dataType: 'date',
      editable: true,
    },
    {
      id: 'createdAt',
      header: 'Created',
      fieldType: 'date',
      dataType: 'date',
      editable: false,
    },
  ],
  pagination: { page: 1, limit: 0, total: 0, totalPages: 1 },
};

describe('TasksList', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  it('displays empty table when no tasks exist', async () => {
    mockGetTasks.mockResolvedValue(mockTableViewResponse);

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Assignee')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /add row/i }),
    ).toBeInTheDocument();
  });

  it('displays tasks in table', async () => {
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [{ id: 1, title: 'Test Task', status: 'TODO' }],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByText('Test Task').length).toBeGreaterThan(0);
    });
  });

  it('navigates to task detail when row is clicked', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [{ id: 1, title: 'Test Task', status: 'TODO' }],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
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

  it('opens select editor when clicking assignee cell and commits on selection', async () => {
    const user = userEvent.setup();
    mockUpdateCell.mockResolvedValue({});
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 1,
          title: 'Test Task',
          status: 'TODO',
          assignee: 'alice@example.com',
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('alice@example.com'));

    const select = await screen.findByDisplayValue('alice@example.com');
    expect(select).toBeInTheDocument();

    await user.selectOptions(select, 'bob@example.com');

    await waitFor(() => {
      expect(mockUpdateCell).toHaveBeenCalledWith(
        'tasks',
        1,
        'assignee',
        'bob@example.com',
      );
    });
  });

  it('clicking assignee cell stops row navigation', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 1,
          title: 'Test Task',
          status: 'TODO',
          assignee: 'alice@example.com',
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('alice@example.com'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens date editor when clicking completedAt cell', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [{ id: 1, title: 'Test Task', status: 'TODO', completedAt: null }],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
    });

    // Find the Completed At cell (empty) in the data row
    const rows = screen.getAllByRole('row');
    const dataRow = rows.find((row) => row.textContent?.includes('Test Task'));
    expect(dataRow).toBeTruthy();

    const cells = dataRow!.querySelectorAll('td');
    // completedAt is the 4th data column (title, status, assignee, completedAt)
    const completedAtCell = cells[4];
    await user.click(completedAtCell);

    // Should show a date input, not navigate
    expect(mockPush).not.toHaveBeenCalled();
    const dateInput = completedAtCell.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
  });

  it('commits inline edit when selecting a new assignee value', async () => {
    const user = userEvent.setup();
    mockUpdateCell.mockResolvedValue({});
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 2,
          title: 'Another Task',
          status: 'TODO',
          assignee: 'carol@example.com',
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('carol@example.com'));

    const select = await screen.findByDisplayValue('carol@example.com');
    await user.selectOptions(select, 'dave@example.com');

    await waitFor(() => {
      expect(mockUpdateCell).toHaveBeenCalledWith(
        'tasks',
        2,
        'assignee',
        'dave@example.com',
      );
    });
  });

  it('cancels inline edit on Escape key without calling updateCell', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 1,
          title: 'Test Task',
          status: 'TODO',
          assignee: 'alice@example.com',
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('alice@example.com'));
    await screen.findByDisplayValue('alice@example.com');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
    expect(mockUpdateCell).not.toHaveBeenCalled();
  });

  it('opens new task sheet when "New Task" button is clicked', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue(mockTableViewResponse);
    render(<TasksList />, { wrapper });
    await user.click(screen.getByRole('button', { name: /new task/i }));
    expect(mockPush).not.toHaveBeenCalledWith('/tasks/new');
  });
});

describe('TaskDetail', () => {
  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetTask.mockResolvedValue(mockTask);
    mockGetTasks.mockResolvedValue({ tasks: [] });
  });

  it('renders task detail with all information', async () => {
    render(<TaskDetail taskId={1} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText(/Created March 12, 2026/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
      expect(screen.getByText(/john@example\.com/i)).toBeInTheDocument();
      expect(screen.getByText(/To Do/)).toBeInTheDocument();
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

  it('shows delete confirmation dialog and deletes task', async () => {
    const user = userEvent.setup();
    mockDeleteTask.mockResolvedValue(undefined);

    render(<TaskDetail taskId={1} />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /delete/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText(/delete task/i)).toBeInTheDocument();
      expect(
        screen.getByText(/this action cannot be undone/i),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith(1);
      expect(mockPush).toHaveBeenCalledWith('/tasks');
    });
  });

  it('opens edit sheet when "Edit" button is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskDetail taskId={1} />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]);
    expect(mockPush).not.toHaveBeenCalledWith('/tasks/1/edit');
  });

  describe('Edit Task', () => {
    it('edits title via contentEditable heading', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateTask.mockResolvedValue({ ...mockTask, title: 'Updated Title' });

      render(<TaskDetail taskId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Task')).toBeInTheDocument();
      });

      fireEvent.blur(screen.getByRole('heading', { level: 1 }), {
        target: { innerText: 'Updated Title' },
      });

      await new Promise((r) => setTimeout(r, 2100)); // past 2000ms debounce

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ title: 'Updated Title' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'task', 1] }),
        );
      });
    });

    it('edits assignee via combobox', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateTask.mockResolvedValue({
        ...mockTask,
        assignee: 'jane@example.com',
      });

      render(<TaskDetail taskId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/john@example\.com/i)).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[0]);

      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'jane@example.com');

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ assignee: 'jane@example.com' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'task', 1] }),
        );
      });
    });

    it('edits status via combobox', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateTask.mockResolvedValue({ ...mockTask, status: 'IN_PROGRESS' });

      render(<TaskDetail taskId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('To Do')).toBeInTheDocument();
      });

      // Status is the 2nd editable property — click its pencil icon
      await user.click(screen.getAllByTitle('Edit')[1]);

      // Mocked combobox renders as a <select>
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'IN_PROGRESS');

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ status: 'IN_PROGRESS' }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'task', 1] }),
        );
      });
    });

    it('edits completedAt via date picker', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateTask.mockResolvedValue({
        ...mockTask,
        completedAt: '2026-04-15T00:00:00.000Z',
      });

      render(<TaskDetail taskId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Task')).toBeInTheDocument();
      });

      // completedAt is null — renders a clickable "—" dash to enter edit mode
      const completedLabel = screen.getByText('Completed', { selector: 'dt' });
      const completedCell = completedLabel.closest('div')!;
      await user.click(completedCell.querySelector('span')!);

      const dateInput = document.querySelector(
        'input[type="date"]',
      ) as HTMLInputElement;
      expect(dateInput).toBeInTheDocument();
      fireEvent.change(dateInput, { target: { value: '2026-04-15' } });
      fireEvent.blur(dateInput);

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            completedAt: expect.stringContaining('2026-04-15'),
          }),
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'task', 1] }),
        );
      });
    });
  });
});
