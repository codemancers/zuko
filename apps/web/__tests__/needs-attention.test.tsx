import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AttentionTask } from '@/lib/api/sales-overview';
import { SalesOverview } from '@/components/SalesOverview/SalesOverview';

const state = vi.hoisted(() => ({ get: vi.fn(), org: '7', allowed: true }));
vi.mock('@/lib/api/sales-overview', () => ({ getNeedsAttention: state.get }));
vi.mock('@/hooks/use-sales-overview-access', () => ({
  useSalesOverviewAccess: () => ({ allowed: state.allowed, loading: false }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useActiveOrganization: () => ({ data: { id: state.org } }) },
}));
vi.mock('@/components/Tasks/SalesTaskCreateButton', () => ({
  SalesTaskCreateButton: () => <button>Add task</button>,
}));
const first: AttentionTask = {
  id: 434,
  title: 'Call prospective customer',
  status: 'TODO',
  priority: 'HIGH',
  dueDate: '2026-11-04',
  assigneeUserId: 9,
  assigneeUser: { id: 9, name: 'Another Admin' },
  contactId: 12,
  prospectId: null,
  parentId: null,
};
const result = (
  tasks: AttentionTask[] = [first],
  page = 1,
  total = tasks.length,
) => ({
  tasks,
  pagination: { page, limit: 10, total, totalPages: Math.ceil(total / 10) },
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...render(<SalesOverview organizationId={7} />, { wrapper }),
  };
}
beforeEach(() => {
  state.org = '7';
  state.allowed = true;
  state.get.mockReset().mockResolvedValue(result());
});
describe('Needs attention live rows', () => {
  it('links a prospect without inventing missing person names or links', async () => {
    state.get.mockResolvedValue(
      result([
        { ...first, contactId: null, prospectId: 22 },
        {
          ...first,
          id: 435,
          title: 'Task without person',
          contactId: null,
          prospectId: null,
        },
      ]),
    );
    setup();
    expect(
      await screen.findByRole('link', { name: 'Prospect #22' }),
    ).toHaveAttribute('href', '/prospects/22');
    expect(
      screen.queryByRole('link', { name: /Contact/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Task without person')).toBeInTheDocument();
  });

  it('removes old organization rows and its open drawer during an organization switch', async () => {
    const view = setup();
    fireEvent.click(
      await screen.findByRole('button', { name: `Review ${first.title}` }),
    );
    await screen.findByRole('dialog');
    state.org = '8';
    state.get.mockReturnValue(new Promise(() => {}));
    view.rerender(<SalesOverview organizationId={8} />);
    expect(screen.queryByText(first.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(state.get.mock.calls.at(-1)?.[0]).toBe(8));
  });
  it('does not fetch or expose tasks when dashboard access is denied', () => {
    state.allowed = false;
    setup();
    expect(
      screen.getByText('Sales Overview is restricted'),
    ).toBeInTheDocument();
    expect(state.get).not.toHaveBeenCalled();
  });
  it('hides previously cached rows if the next read is denied', async () => {
    const view = setup();
    await screen.findByText(first.title);
    state.get.mockRejectedValue(new Error('Forbidden'));
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: ['tasks'] });
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(first.title)).not.toBeInTheDocument();
  });
  it('refreshes when the shared task form invalidates tasks', async () => {
    const view = setup();
    await screen.findByText(first.title);
    state.get.mockResolvedValue(
      result([{ ...first, id: 999, title: 'Newly created task' }]),
    );
    await act(async () => {
      await view.client.invalidateQueries({ queryKey: ['tasks'] });
    });
    expect(await screen.findByText('Newly created task')).toBeInTheDocument();
  });

  it('refreshes the cutoff after local midnight without requiring navigation', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-05T23:59:30'));
    try {
      const view = setup();
      await screen.findByText(first.title);
      expect(state.get.mock.calls.at(-1)?.[1]).toBe('2026-11-05');
      await act(async () => {
        vi.advanceTimersByTime(60000);
      });
      await waitFor(() =>
        expect(state.get.mock.calls.at(-1)?.[1]).toBe('2026-11-06'),
      );
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a read-only Review Sheet and closes without mutating the task', async () => {
    setup();
    fireEvent.click(
      await screen.findByRole('button', { name: `Review ${first.title}` }),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open full task' }),
    ).toHaveAttribute('href', '/tasks/434');
    expect(
      screen.queryByRole('button', { name: 'Mark done' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close task review' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByText(first.title)).toBeInTheDocument();
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it('uses server pagination without retaining old page rows and can return to previous overdue work', async () => {
    state.get.mockImplementation((_org, _date, page) =>
      Promise.resolve(
        page === 1
          ? result([first], 1, 11)
          : result([{ ...first, id: 435, title: 'Second page task' }], 2, 11),
      ),
    );
    setup();
    await screen.findByText(first.title);
    expect(
      screen.getByRole('button', { name: 'Previous tasks' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next tasks' }));
    expect(await screen.findByText('Second page task')).toBeInTheDocument();
    expect(screen.queryByText(first.title)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next tasks' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous tasks' }));
    expect(await screen.findByText(first.title)).toBeInTheDocument();
  });

  it('distinguishes loading from empty success', async () => {
    let resolve!: (value: ReturnType<typeof result>) => void;
    state.get.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    setup();
    expect(screen.getByText('Loading tasks…')).toBeInTheDocument();
    expect(
      screen.queryByText('No tasks need attention'),
    ).not.toBeInTheDocument();
    resolve(result([]));
    expect(
      await screen.findByText('No tasks need attention'),
    ).toBeInTheDocument();
  });
  it('shows a section error and retries without hiding the other sections', async () => {
    state.get
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(result());
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load tasks',
    );
    expect(
      screen.queryByText('No tasks need attention'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Recent work' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry tasks' }));
    expect(await screen.findByText(first.title)).toBeInTheDocument();
  });

  it('renders the server result including another Admin, date and contextual person link', async () => {
    setup();
    expect(await screen.findByText(first.title)).toBeInTheDocument();
    expect(screen.getByText('Another Admin')).toBeInTheDocument();
    expect(screen.getByText(/4 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact #12' })).toHaveAttribute(
      'href',
      '/contacts/12',
    );
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
