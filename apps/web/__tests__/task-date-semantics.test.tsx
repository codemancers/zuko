/**
 * @vitest-environment jsdom
 *
 * Characterization tests for #7361 (task date semantics). They pin down how the
 * current task UI reads and writes dates; they do not describe a desired
 * contract. See docs/technical/task-date-semantics-7361.md.
 */
import React from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntityProperties } from '@/components/shared/EntityProperties';
import { DateEditor } from '@/components/Table/CellEditors';
import { formatDate } from '@/lib/format-utils';
import TaskForm from '@/components/Tasks/TaskForm';
import TasksList from '@/components/Tasks/TasksList';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import type { Task } from '@/lib/api/tasks';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { user: { id: '1' } } })),
    useActiveOrganization: vi.fn(() => ({ data: { id: 'org-1' } })),
    organization: {
      listMembers: vi.fn(() => Promise.resolve({ data: { members: [] } })),
    },
  },
}));

const mockUpdateTask = vi.fn();
const mockGetTasks = vi.fn();
vi.mock('@/lib/api/tasks', () => ({
  tasksApi: {
    createTask: vi.fn(),
    updateTask: (...args: unknown[]) => mockUpdateTask(...args),
    getTasks: (...args: unknown[]) => mockGetTasks(...args),
    getTableViewTasks: (...args: unknown[]) => mockGetTasks(...args),
    getTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

vi.mock('@/lib/api/tables', () => ({
  tablesApi: { updateCell: vi.fn() },
}));

const mockGetTimeline = vi.fn();
vi.mock('@/lib/api/activities', () => ({
  activitiesApi: {
    getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
    createComment: vi.fn(),
    updateActivity: vi.fn(),
  },
}));

// Node re-reads process.env.TZ on assignment, so a browser zone can be pinned
// per test without touching the machine setting. Each test asserts the
// expected offset so a runtime that ignores the switch fails loudly.
const originalTZ = process.env.TZ;
function useTimeZone(tz: string, offsetAt: string, expectedOffset: number) {
  process.env.TZ = tz;
  expect(new Date(offsetAt).getTimezoneOffset()).toBe(expectedOffset);
}

let queryClient: QueryClient;
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

// Same property shape TaskDetail passes for "Completed".
function renderCompleted(value: string | null, onSave = vi.fn()) {
  const utils = render(
    <EntityProperties
      properties={[
        {
          label: 'Completed',
          value,
          renderType: 'date',
          fieldType: 'date',
          onSave,
        },
      ]}
    />,
  );
  const cell = () =>
    screen.getByText('Completed', { selector: 'dt' }).nextElementSibling!;
  return { ...utils, cell, onSave };
}

// 20:00 UTC on Nov 2 is 01:30 on Nov 3 in India and 12:00 on Nov 2 in LA.
const EVENING_UTC = '2026-11-02T20:00:00.000Z';

describe('EntityProperties date display (TaskDetail "Completed")', () => {
  it.each([
    ['UTC', 0, 'Nov 2, 2026'],
    ['Asia/Kolkata', -330, 'Nov 3, 2026'],
    ['America/Los_Angeles', 480, 'Nov 2, 2026'],
  ])(
    'renders one stored instant in the browser zone: %s',
    (tz, offset, label) => {
      useTimeZone(tz, EVENING_UTC, offset);
      const { cell } = renderCompleted(EVENING_UTC);
      expect(cell()).toHaveTextContent(label);
    },
  );

  it('crosses the day on a DST change by zone rules, not a fixed offset', () => {
    // 04:30Z on Nov 2 is 23:30 EST on Nov 1 (DST ended Nov 1). With the
    // pre-change EDT offset (-4) it would have been 00:30 on Nov 2.
    useTimeZone('America/New_York', '2026-11-02T04:30:00.000Z', 300);
    expect(new Date('2026-10-31T12:00:00Z').getTimezoneOffset()).toBe(240);
    const { cell } = renderCompleted('2026-11-02T04:30:00.000Z');
    expect(cell()).toHaveTextContent('Nov 1, 2026');
  });
});

describe('EntityProperties date editor (TaskDetail "Completed")', () => {
  it('seeds the picker with the UTC calendar day, not the displayed local day', async () => {
    useTimeZone('Asia/Kolkata', EVENING_UTC, -330);
    const user = userEvent.setup();
    const { cell } = renderCompleted(EVENING_UTC);
    expect(cell()).toHaveTextContent('Nov 3, 2026');

    await user.click(screen.getByText('Nov 3, 2026'));
    const input = document.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('2026-11-02');
  });

  it('ignores a pick of the displayed local day because the no-op check is local', async () => {
    useTimeZone('Asia/Kolkata', EVENING_UTC, -330);
    const user = userEvent.setup();
    const { onSave } = renderCompleted(EVENING_UTC);

    await user.click(screen.getByText('Nov 3, 2026'));
    const input = document.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-11-03' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(document.querySelector('input[type="date"]')).toBeNull(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    // [zone, offset at the saved instant, displayed day after save]
    ['UTC', 0, 'Nov 3, 2026'],
    ['Asia/Kolkata', -330, 'Nov 3, 2026'],
    ['America/Los_Angeles', 480, 'Nov 2, 2026'],
  ])(
    'saves a backdated pick of 2026-11-03 as UTC midnight; %s then shows %s',
    async (tz, offset, shownAfterSave) => {
      useTimeZone(tz, '2026-11-03T00:00:00.000Z', offset);
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderCompleted(null, onSave);

      fireEvent.click(screen.getByText('—'));
      const input = document.querySelector(
        'input[type="date"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '2026-11-03' } });
      fireEvent.blur(input);

      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith('2026-11-03T00:00:00.000Z'),
      );

      rerender(
        <EntityProperties
          properties={[
            {
              label: 'Completed',
              value: onSave.mock.calls[0][0],
              renderType: 'date',
              fieldType: 'date',
              onSave,
            },
          ]}
        />,
      );
      await waitFor(() =>
        expect(screen.getByText(shownAfterSave)).toBeInTheDocument(),
      );
    },
  );

  it('saves a DST-day pick as UTC midnight, which New York shows as the day before', async () => {
    useTimeZone('America/New_York', '2026-11-01T00:00:00.000Z', 240);
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderCompleted(null, onSave);

    fireEvent.click(screen.getByText('—'));
    const input = document.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-11-01' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('2026-11-01T00:00:00.000Z'),
    );
    const saved = renderCompleted('2026-11-01T00:00:00.000Z');
    expect(within(saved.container).getByText('Oct 31, 2026')).toBeVisible();
  });
});

describe('Tasks table date cell (formatDate + DateEditor)', () => {
  it('displays the local day but edits the UTC day', () => {
    useTimeZone('Asia/Kolkata', EVENING_UTC, -330);
    expect(formatDate(EVENING_UTC)).toBe('03 Nov 2026');

    render(
      <DateEditor
        value={EVENING_UTC}
        onChange={vi.fn()}
        onBlur={vi.fn()}
        onKeyDown={vi.fn()}
        metadata={{} as never}
      />,
    );
    expect(
      (document.querySelector('input[type="date"]') as HTMLInputElement).value,
    ).toBe('2026-11-02');
  });
});

describe('TasksList "Mark complete"', () => {
  it('writes the browser clock as a UTC instant whose date prefix is not the local day', async () => {
    useTimeZone('Asia/Kolkata', '2026-11-02T18:30:00.000Z', -330);
    // Exactly local midnight starting Nov 3 in India.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-02T18:30:00.000Z'));

    mockGetTasks.mockResolvedValue({
      data: [{ id: 1, title: 'Call Asha', status: 'TODO' }],
      metadata: [
        {
          id: 'title',
          header: 'Title',
          fieldType: 'entity',
          dataType: 'text',
          editable: true,
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    mockUpdateTask.mockResolvedValue({});

    render(<TasksList />, { wrapper });
    fireEvent.click(
      await screen.findByRole('button', { name: /mark complete/i }),
    );

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    const [id, payload] = mockUpdateTask.mock.calls[0];
    expect(id).toBe(1);
    expect(payload).toEqual({
      status: 'DONE',
      completedAt: '2026-11-02T18:30:00.000Z',
    });
    // Slicing the ISO string gives the UTC day, a day behind the user.
    expect(payload.completedAt.slice(0, 10)).toBe('2026-11-02');
    const { cell } = renderCompleted(payload.completedAt);
    expect(cell()).toHaveTextContent('Nov 3, 2026');
  });
});

describe('TaskForm status change to Done', () => {
  it('sends status DONE without completedAt', async () => {
    mockGetTasks.mockResolvedValue({
      tasks: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    });
    mockUpdateTask.mockResolvedValue({ id: 1 });
    const task: Task = {
      id: 1,
      organizationId: 1,
      title: 'Call Asha',
      description: null,
      status: 'TODO',
      priority: 'MEDIUM',
      isSales: true,
      completedAt: null,
      parentId: null,
      assignee: null,
      assigneeUserId: null,
      owners: [],
      subtasks: [],
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };
    const user = userEvent.setup();

    render(<TaskForm mode="edit" task={task} onSuccess={vi.fn()} />, {
      wrapper,
    });
    await user.selectOptions(screen.getByLabelText('Status'), 'DONE');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalled());
    const payload = mockUpdateTask.mock.calls[0][1];
    expect(payload.status).toBe('DONE');
    expect(payload).not.toHaveProperty('completedAt');
  });
});

describe('ActivityTimeline task history', () => {
  it('shows recording time relative to now, the actor, and no occurrence date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-03T10:00:00.000Z'));
    // The task's completedAt may say Oct 30; the activity row has no such field.
    mockGetTimeline.mockResolvedValue({
      activities: [
        {
          id: 1,
          activityType: 'task_status_changed',
          entityType: 'task',
          entityId: 7,
          content: null,
          metadata: { from: 'TODO', to: 'DONE' },
          actorId: 42,
          actor: { id: 42, name: 'Asha Admin', email: 'a@example.com' },
          createdAt: '2026-11-03T09:59:00.000Z',
          updatedAt: '2026-11-03T09:59:00.000Z',
        },
        {
          id: 2,
          activityType: 'task_created',
          entityType: 'task',
          entityId: 7,
          content: null,
          metadata: {},
          actorId: null,
          actor: null,
          createdAt: '2026-11-02T10:00:00.000Z',
          updatedAt: '2026-11-02T10:00:00.000Z',
        },
      ],
    });

    render(<ActivityTimeline entityType="task" entityId={7} />, { wrapper });

    const items = await screen.findAllByTestId('activity-item');
    expect(items[0]).toHaveTextContent('Asha Admin');
    expect(items[0]).toHaveTextContent('a minute ago');
    expect(items[0]).toHaveTextContent('moved task from To Do to Done');
    expect(items[0].textContent).not.toMatch(/Oct|2026/);
    expect(items[1]).toHaveTextContent('System');
    expect(items[1]).toHaveTextContent('a day ago');
  });
});
