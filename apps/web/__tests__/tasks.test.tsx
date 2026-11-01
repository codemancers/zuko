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
              ...['john', 'jane', 'alice', 'bob', 'carol', 'dave'].map(
                (n, i) => ({
                  id: 500 + i,
                  userId: 101 + i,
                  user: {
                    id: 101 + i,
                    name: `${n}@example.com`,
                    email: `${n}@example.com`,
                  },
                }),
              ),
              // Member.id deliberately differs from userId; names collide.
              {
                id: 901,
                userId: 7,
                user: { id: 7, name: 'Sam Lee', email: 'sam.a@example.com' },
              },
              {
                id: 902,
                userId: 8,
                user: { id: 8, name: 'Sam Lee', email: 'sam.b@example.com' },
              },
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
            {o.description
              ? `${o.label} ${o.description}`
              : (o.label ?? o.code ?? String(o))}
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
  priority: 'MEDIUM',
  isSales: false,
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

  it.each([false, true])('creates a task with isSales=%s', async (isSales) => {
    const user = userEvent.setup();
    mockCreateTask.mockResolvedValue({ ...mockTask, isSales });
    render(<TaskForm mode="create" />, { wrapper });
    const checkbox = screen.getByRole('checkbox', { name: 'Sales task' });
    expect(checkbox).not.toBeChecked();
    if (isSales) await user.click(checkbox);
    await user.type(screen.getByLabelText(/title \*/i), 'Sales test');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() =>
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sales test', isSales }),
      ),
    );
  });

  it('allows a caller to default new sales tasks on', () => {
    render(<TaskForm mode="create" defaultIsSales />, { wrapper });
    expect(screen.getByRole('checkbox', { name: 'Sales task' })).toBeChecked();
  });

  it.each([true, false, undefined])(
    'edit uses persisted %s, not creation default',
    (isSales) => {
      render(
        <TaskForm
          mode="edit"
          task={{ ...mockTask, isSales } as Task}
          defaultIsSales
        />,
        { wrapper },
      );
      expect(
        screen.getByRole('checkbox', { name: 'Sales task' }),
      ).toHaveAttribute('aria-checked', String(isSales ?? false));
    },
  );

  it('edits a sales task to false and retains its other fields', async () => {
    const user = userEvent.setup();
    mockUpdateTask.mockResolvedValue({ ...mockTask, isSales: false });
    render(<TaskForm mode="edit" task={{ ...mockTask, isSales: true }} />, {
      wrapper,
    });
    await user.click(screen.getByRole('checkbox', { name: 'Sales task' }));
    fireEvent.submit(
      screen.getByRole('checkbox', { name: 'Sales task' }).closest('form')!,
    );
    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith(
        mockTask.id,
        expect.objectContaining({
          isSales: false,
          title: mockTask.title,
          priority: mockTask.priority,
        }),
      ),
    );
  });

  it('retains the selection on validation and save errors', async () => {
    const user = userEvent.setup();
    mockCreateTask.mockRejectedValue(new Error('Network error'));
    render(<TaskForm mode="create" />, { wrapper });
    const checkbox = screen.getByRole('checkbox', { name: 'Sales task' });
    await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: /create task/i }));
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(checkbox).toBeChecked();
    await user.type(screen.getByLabelText(/title \*/i), 'Keep selection');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Network error'),
    );
    expect(checkbox).toBeChecked();
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

  describe('assignee', () => {
    const assigneeSelect = () =>
      screen.getByRole('combobox', { name: /select assignee/i });

    it('lists duplicate-name members by name and email and creates with the member userId', async () => {
      const user = userEvent.setup();
      mockCreateTask.mockResolvedValue(mockTask);
      render(<TaskForm mode="create" />, { wrapper });

      await screen.findByRole('option', { name: 'Sam Lee sam.b@example.com' });
      expect(
        screen.getByRole('option', { name: 'Sam Lee sam.a@example.com' }),
      ).toBeInTheDocument();

      await user.type(screen.getByLabelText(/title \*/i), 'Assigned');
      await user.selectOptions(assigneeSelect(), '8');
      await user.click(screen.getByRole('button', { name: /create task/i }));

      await waitFor(() => expect(mockCreateTask).toHaveBeenCalled());
      const payload = mockCreateTask.mock.calls[0][0];
      expect(payload.assigneeUserId).toBe(8);
      expect(payload).not.toHaveProperty('assignee');
    });

    it('preselects a stable assignee by userId and clears it explicitly', async () => {
      const user = userEvent.setup();
      mockUpdateTask.mockResolvedValue(mockTask);
      render(
        <TaskForm
          mode="edit"
          task={{
            ...mockTask,
            assignee: 'Stale Name',
            assigneeUserId: 8,
            assigneeUser: {
              id: 8,
              name: 'Sam Lee',
              email: 'sam.b@example.com',
            },
          }}
        />,
        { wrapper },
      );

      await screen.findByRole('option', { name: 'Sam Lee sam.b@example.com' });
      expect(assigneeSelect()).toHaveValue('8');

      await user.selectOptions(assigneeSelect(), 'Unassigned');
      fireEvent.submit(assigneeSelect().closest('form')!);

      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
      const payload = mockUpdateTask.mock.calls[0][1];
      expect(payload.assigneeUserId).toBeNull();
      expect(payload).not.toHaveProperty('assignee');
    });

    it('shows an unresolved legacy name explicitly and preserves it on unrelated edits', async () => {
      const user = userEvent.setup();
      mockUpdateTask.mockResolvedValue(mockTask);
      render(
        <TaskForm
          mode="edit"
          task={{ ...mockTask, assignee: 'Sam Lee', assigneeUserId: null }}
        />,
        { wrapper },
      );

      await screen.findByRole('option', { name: 'Sam Lee sam.a@example.com' });
      const selected = assigneeSelect() as HTMLSelectElement;
      expect(selected.selectedOptions[0]).toHaveTextContent(
        /Sam Lee.*legacy name, not linked/i,
      );

      const title = screen.getByLabelText(/title \*/i);
      await user.clear(title);
      await user.type(title, 'Retitled');
      fireEvent.submit(title.closest('form')!);

      await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
      const payload = mockUpdateTask.mock.calls[0][1];
      expect(payload.title).toBe('Retitled');
      expect(payload).not.toHaveProperty('assignee');
      expect(payload).not.toHaveProperty('assigneeUserId');
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

  it('displays empty state when no tasks exist', async () => {
    mockGetTasks.mockResolvedValue(mockTableViewResponse);

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Assignee')).not.toBeInTheDocument();
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /new task/i }).length).toBe(2);
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

  it('opens select editor when clicking assignee cell and commits the member userId', async () => {
    const user = userEvent.setup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockUpdateTask.mockResolvedValue({});
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 1,
          title: 'Test Task',
          status: 'TODO',
          assignee: 'alice@example.com',
          assigneeUserId: 103,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('alice@example.com'));

    const select = await screen.findByDisplayValue(
      'alice@example.com (alice@example.com)',
    );
    expect(select).toHaveValue('103');

    await user.selectOptions(select, '104');

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith(1, { assigneeUserId: 104 });
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['tasks'] }),
      );
    });
    expect(mockUpdateCell).not.toHaveBeenCalled();
  });

  it('distinguishes duplicate-name members by email and assigns by userId', async () => {
    const user = userEvent.setup();
    mockUpdateTask.mockResolvedValue({});
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 3,
          title: 'Dup Task',
          status: 'TODO',
          assignee: 'Sam Lee',
          assigneeUserId: 7,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await user.click(await screen.findByText('Sam Lee'));
    const select = await screen.findByDisplayValue(
      'Sam Lee (sam.a@example.com)',
    );
    expect(
      screen.getByRole('option', { name: 'Sam Lee (sam.b@example.com)' }),
    ).toBeInTheDocument();

    await user.selectOptions(select, '8');

    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith(3, { assigneeUserId: 8 }),
    );
    expect(mockUpdateCell).not.toHaveBeenCalled();
  });

  it('clears a table assignee with an explicit null', async () => {
    const user = userEvent.setup();
    mockUpdateTask.mockResolvedValue({});
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 4,
          title: 'Clear Task',
          status: 'TODO',
          assignee: 'Sam Lee',
          assigneeUserId: 8,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await user.click(await screen.findByText('Sam Lee'));
    const select = await screen.findByDisplayValue(
      'Sam Lee (sam.b@example.com)',
    );
    await user.selectOptions(select, 'Unassigned');

    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith(4, { assigneeUserId: null }),
    );
    expect(mockUpdateCell).not.toHaveBeenCalled();
  });

  it('shows an unresolved legacy table assignee explicitly without matching it to a member', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 5,
          title: 'Legacy Task',
          status: 'TODO',
          assignee: 'alice@example.com',
          assigneeUserId: null,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    const cell = await screen.findByText(
      'alice@example.com (legacy name, not linked)',
    );
    await user.click(cell);
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    // A matching member name must not be preselected.
    expect(select.value).not.toBe('103');
    await user.keyboard('{Escape}');

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockUpdateCell).not.toHaveBeenCalled();
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
          assigneeUserId: 103,
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
    mockUpdateTask.mockResolvedValue({});
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 2,
          title: 'Another Task',
          status: 'TODO',
          assignee: 'carol@example.com',
          assigneeUserId: 105,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('carol@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('carol@example.com'));

    const select = await screen.findByDisplayValue(
      'carol@example.com (carol@example.com)',
    );
    await user.selectOptions(select, '106');

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith(2, { assigneeUserId: 106 });
    });
  });

  it('cancels inline edit on Escape key without saving', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue({
      ...mockTableViewResponse,
      data: [
        {
          id: 1,
          title: 'Test Task',
          status: 'TODO',
          assignee: 'alice@example.com',
          assigneeUserId: 103,
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    render(<TasksList />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    await user.click(screen.getByText('alice@example.com'));
    await screen.findByDisplayValue('alice@example.com (alice@example.com)');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
    expect(mockUpdateCell).not.toHaveBeenCalled();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it('opens new task sheet when "New Task" button is clicked', async () => {
    const user = userEvent.setup();
    mockGetTasks.mockResolvedValue(mockTableViewResponse);
    render(<TasksList />, { wrapper });
    await user.click(screen.getByRole('button', { name: /new task/i }));
    expect(mockPush).not.toHaveBeenCalledWith('/tasks/new');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /new task/i }),
    ).toBeInTheDocument();
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
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /edit task/i }),
    ).toBeInTheDocument();
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

    it('edits assignee via combobox using the member userId', async () => {
      const user = userEvent.setup();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockUpdateTask.mockResolvedValue({
        ...mockTask,
        assignee: 'Sam Lee',
        assigneeUserId: 8,
      });

      render(<TaskDetail taskId={1} />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/john@example\.com/i)).toBeInTheDocument();
      });

      await user.click(screen.getAllByTitle('Edit')[0]);

      const select = await screen.findByRole('combobox');
      await screen.findByRole('option', { name: 'Sam Lee sam.b@example.com' });
      expect(
        screen.getByRole('option', { name: 'Sam Lee sam.a@example.com' }),
      ).toBeInTheDocument();
      await user.selectOptions(select, '8');

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith(1, { assigneeUserId: 8 });
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ['timeline', 'task', 1] }),
        );
      });
    });

    it('clears a stable assignee inline with an explicit null', async () => {
      const user = userEvent.setup();
      mockGetTask.mockResolvedValue({
        ...mockTask,
        assignee: 'Sam Lee',
        assigneeUserId: 8,
        assigneeUser: { id: 8, name: 'Sam Lee', email: 'sam.b@example.com' },
      });
      mockUpdateTask.mockResolvedValue(mockTask);

      render(<TaskDetail taskId={1} />, { wrapper });
      await screen.findByText('Sam Lee');

      await user.click(screen.getAllByTitle('Edit')[0]);
      const select = await screen.findByRole('combobox');
      await screen.findByRole('option', { name: 'Sam Lee sam.b@example.com' });
      expect(select).toHaveValue('8');
      await user.selectOptions(select, 'Unassigned');

      await waitFor(() =>
        expect(mockUpdateTask).toHaveBeenCalledWith(1, {
          assigneeUserId: null,
        }),
      );
    });

    it('displays the current related user name instead of a stale legacy name', async () => {
      mockGetTask.mockResolvedValue({
        ...mockTask,
        assignee: 'Stale Name',
        assigneeUserId: 8,
        assigneeUser: {
          id: 8,
          name: 'Renamed Sam',
          email: 'sam.b@example.com',
        },
      });

      render(<TaskDetail taskId={1} />, { wrapper });

      expect(await screen.findByText('Renamed Sam')).toBeInTheDocument();
      expect(screen.queryByText(/Stale Name/)).not.toBeInTheDocument();
    });

    it('labels an unresolved legacy assignee explicitly', async () => {
      mockGetTask.mockResolvedValue({
        ...mockTask,
        assignee: 'Ghost Person',
        assigneeUserId: null,
        assigneeUser: null,
      });

      render(<TaskDetail taskId={1} />, { wrapper });

      expect(
        await screen.findByText(/Ghost Person \(legacy name, not linked\)/),
      ).toBeInTheDocument();
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
