/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeetingList } from '@/components/meeting/meeting-list';
import AddMeeting from '@/components/meeting/add-meeting';
import MeetingDetail from '@/components/meeting/meeting-detail';
import type { Meeting } from '@/lib/api/meetings';

if (typeof ResizeObserver === 'undefined') {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
}

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

// Simple Dropdown mock that toggles visibility on button click
vi.mock('@zuko/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zuko/ui-kit')>();
  const React = await import('react');
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const DropdownCtx = React.createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: (): void => {} });

  function Dropdown({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return (
      <DropdownCtx.Provider value={{ open, toggle: () => setOpen((o) => !o) }}>
        {children}
      </DropdownCtx.Provider>
    );
  }

  function DropdownButton({ children, plain: _plain, ...props }: any) {
    const { toggle } = React.useContext(DropdownCtx);
    return (
      <button type="button" onClick={toggle} {...props}>
        {children}
      </button>
    );
  }

  function DropdownMenu({ children }: any) {
    const { open } = React.useContext(DropdownCtx);
    return open ? <div>{children}</div> : null;
  }

  function DropdownItem({ children, href, onClick, disabled }: any) {
    if (href) {
      return (
        <a href={href} role="menuitem" aria-disabled={disabled}>
          {children}
        </a>
      );
    }
    return (
      <button type="button" role="menuitem" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  }

  return { ...actual, Dropdown, DropdownButton, DropdownMenu, DropdownItem };
});

// Simple ConfirmDialog mock that renders inline without Headless UI
vi.mock('@/components/shared/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    onClose,
    onConfirm,
    description,
    confirmText,
    cancelText,
  }: any) => {
    if (!open) return null;
    return (
      <div role="dialog">
        <p>{description}</p>
        <button type="button" onClick={onClose}>
          {cancelText ?? 'Cancel'}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmText ?? 'Confirm'}
        </button>
      </div>
    );
  },
}));

const mockDeleteMeeting = vi.fn();
const mockEndMeeting = vi.fn();
const mockCreateMeeting = vi.fn();
const mockGetTableViewMeetings = vi.fn();
vi.mock('@/lib/api/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/meetings')>();
  return {
    ...actual,
    meetingsApi: {
      getMeetings: vi.fn().mockResolvedValue([]),
      getMeeting: vi.fn().mockResolvedValue(null),
      getTableViewMeetings: (...args: unknown[]) => mockGetTableViewMeetings(...args),
      deleteMeeting: (...args: unknown[]) => mockDeleteMeeting(...args),
      endMeeting: (...args: unknown[]) => mockEndMeeting(...args),
      createMeeting: (...args: unknown[]) => mockCreateMeeting(...args),
    },
  };
});

const MOCK_MEETINGS: Meeting[] = [
  {
    id: 2,
    name: 'Q1 Roadmap Planning',
    platform: 'ZOOM',
    status: 'COMPLETED',
    scheduledAt: '2024-01-15T10:00:00Z',
    timezone: 'UTC',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    description: null,
    url: 'https://zoom.us/j/2',
    recording: null,
    recordingUrl: null,
    transcript: null,
    summaries: [],
    actionItems: [],
    transcriptData: null,
    chatMessages: null,
  },
  {
    id: 1,
    name: 'Weekly Product Sync',
    platform: 'ZOOM',
    status: 'COMPLETED',
    scheduledAt: '2024-01-14T10:00:00Z',
    timezone: 'UTC',
    createdAt: '2024-01-14T10:00:00Z',
    updatedAt: '2024-01-14T10:00:00Z',
    description: null,
    url: 'https://zoom.us/j/1',
    recording: null,
    recordingUrl: null,
    transcript: null,
    summaries: [],
    actionItems: [],
    transcriptData: null,
    chatMessages: null,
  },
  {
    id: 3,
    name: 'Frontend Performance Review',
    platform: 'ZOOM',
    status: 'COMPLETED',
    scheduledAt: '2024-01-13T10:00:00Z',
    timezone: 'UTC',
    createdAt: '2024-01-13T10:00:00Z',
    updatedAt: '2024-01-13T10:00:00Z',
    description: null,
    url: 'https://zoom.us/j/3',
    recording: null,
    recordingUrl: null,
    transcript: null,
    summaries: [],
    actionItems: [],
    transcriptData: null,
    chatMessages: null,
  },
];

const MOCK_TABLE_MEETINGS = {
  data: [
    { id: 2, name: 'Q1 Roadmap Planning', platform: { value: 'ZOOM', display: 'Zoom' }, status: { value: 'COMPLETED', display: 'Completed' }, scheduledAt: { value: '2024-01-15T10:00:00Z', display: '15 Jan 2024' } },
    { id: 1, name: 'Weekly Product Sync', platform: { value: 'ZOOM', display: 'Zoom' }, status: { value: 'COMPLETED', display: 'Completed' }, scheduledAt: { value: '2024-01-14T10:00:00Z', display: '14 Jan 2024' } },
    { id: 3, name: 'Frontend Performance Review', platform: { value: 'ZOOM', display: 'Zoom' }, status: { value: 'COMPLETED', display: 'Completed' }, scheduledAt: { value: '2024-01-13T10:00:00Z', display: '13 Jan 2024' } },
  ],
  metadata: [
    { id: 'name', header: 'Name', fieldType: 'entity', dataType: 'text', sortable: true, editable: false, isVisible: true, default: true, config: { hrefTemplate: '/meeting/{id}' } },
    { id: 'platform', header: 'Platform', fieldType: 'select', dataType: 'text', sortable: false, editable: false, isVisible: true, default: true, config: { format: 'stage' } },
    { id: 'scheduledAt', header: 'Date', fieldType: 'date', dataType: 'date', sortable: true, editable: false, isVisible: true, default: true, config: { format: 'date' } },
    { id: 'status', header: 'Status', fieldType: 'select', dataType: 'text', sortable: false, editable: false, isVisible: true, default: true, config: { format: 'stage', render: 'badge' } },
  ],
  pagination: { total: 3, page: 1, limit: 3, totalPages: 1 },
};

const MOCK_MEETING_DETAIL: Meeting = {
  id: 1,
  name: 'Weekly Sync - Product & Engineering',
  platform: 'ZOOM',
  status: 'COMPLETED',
  projectName: 'Zuko AI',
  description: 'Team weekly sync meeting',
  scheduledAt: '2024-01-14T10:00:00Z',
  timezone: 'UTC',
  createdAt: '2024-01-14T10:00:00Z',
  updatedAt: '2024-01-14T10:00:00Z',
  url: 'https://zoom.us/j/1',
  recording: null,
  recordingUrl: 'https://example.com/mov_bbb.mp4',
  transcript: null,
  transcriptData: [
    {
      text: "Hello everyone, let's start the sync",
      speaker_name: 'Alice',
      formatted_duration: '00:00:05',
      is_final: true,
      speech_final: true,
      confidence: 1,
      timestamp: '00:00:05',
      speaker: 0,
      duration_seconds: 5,
    },
    {
      text: 'I have some updates on the UI refactor',
      speaker_name: 'Bob',
      formatted_duration: '00:00:30',
      is_final: true,
      speech_final: true,
      confidence: 1,
      timestamp: '00:00:30',
      speaker: 1,
      duration_seconds: 30,
    },
  ],
  chatMessages: [
    { user: { fullName: 'Alice' }, text: 'Starting now!' },
    { user: { fullName: 'Bob' }, text: 'I will be 2 mins late.' },
  ],
  summaries: [
    {
      id: 1,
      meetingId: 1,
      content:
        'The team discussed the ongoing UI refactor and API documentation needs.',
      createdAt: '2024-01-14T11:00:00Z',
      updatedAt: '2024-01-14T11:00:00Z',
    },
  ],
  actionItems: [
    {
      id: 1,
      meetingId: 1,
      title: 'Review UI refactor components',
      description: null,
      taskId: null,
      createdAt: '2024-01-14T11:00:00Z',
      updatedAt: '2024-01-14T11:00:00Z',
    },
    {
      id: 2,
      meetingId: 1,
      title: 'Review API documentation',
      description: null,
      taskId: null,
      createdAt: '2024-01-14T11:00:00Z',
      updatedAt: '2024-01-14T11:00:00Z',
    },
  ],
};

function createQueryClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  qc.setQueryData(['meetings'], MOCK_MEETINGS);
  qc.setQueryData(['meetings', 'table', { search: undefined }], MOCK_TABLE_MEETINGS);
  qc.setQueryData(['meeting', 1], MOCK_MEETING_DETAIL);
  qc.setQueryData(['meeting', 99], { ...MOCK_MEETING_DETAIL, id: 99 });
  return qc;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('MeetingList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMeeting.mockResolvedValue(undefined);
    mockGetTableViewMeetings.mockResolvedValue(MOCK_TABLE_MEETINGS);
  });

  it('renders Meetings heading, search input, and Add to a meeting button', () => {
    render(<MeetingList />, { wrapper: Wrapper });
    expect(screen.getByText('Meetings')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search meetings...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to a meeting/i })).toBeInTheDocument();
  });

  it('shows meeting names from table data', () => {
    render(<MeetingList />, { wrapper: Wrapper });
    expect(screen.getByText('Weekly Product Sync')).toBeInTheDocument();
    expect(screen.getByText('Q1 Roadmap Planning')).toBeInTheDocument();
    expect(screen.getByText('Frontend Performance Review')).toBeInTheDocument();
  });

  it('navigates to meeting detail when row is clicked', async () => {
    const user = userEvent.setup();
    render(<MeetingList />, { wrapper: Wrapper });
    // Click the date cell (not a link) on the "Weekly Product Sync" row to trigger row click
    const dateCells = screen.getAllByText('14 Jan 2024');
    await user.click(dateCells[0]);
    expect(mockPush).toHaveBeenCalledWith('/meeting/1');
  });

  it('Add to a meeting button opens inline add form', async () => {
    const user = userEvent.setup();
    render(<MeetingList />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /add to a meeting/i }));
    expect(screen.getByPlaceholderText(/enter meeting name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste meeting url/i)).toBeInTheDocument();
  });

  it('opens dropdown and View link has correct href', async () => {
    const user = userEvent.setup();
    render(<MeetingList />, { wrapper: Wrapper });
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[1]);
    const viewItem = await screen.findByRole('menuitem', { name: /view/i }, { timeout: 3000 });
    expect(viewItem).toHaveAttribute('href', '/meeting/1');
  });

  it('opens delete dialog when Delete is clicked', async () => {
    const user = userEvent.setup();
    render(<MeetingList />, { wrapper: Wrapper });
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[0]);
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    await user.click(deleteItem);
    expect(
      screen.getByText('Are you sure you want to delete this meeting?')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('Cancel in delete dialog closes without calling delete', async () => {
    const user = userEvent.setup();
    render(<MeetingList />, { wrapper: Wrapper });
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[0]);
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    await user.click(deleteItem);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Are you sure you want to delete this meeting?')
    ).not.toBeInTheDocument();
  });

  it('Confirm Delete calls toast and closes dialog', async () => {
    const user = userEvent.setup();
    render(<MeetingList />, { wrapper: Wrapper });
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[1]);
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    await user.click(deleteItem);
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    await user.click(deleteBtn);
    expect(mockToastSuccess).toHaveBeenCalledWith('Meeting deleted: 1');
    expect(
      screen.queryByText('Are you sure you want to delete this meeting?')
    ).not.toBeInTheDocument();
  });
});

describe('AddMeeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Add Meeting heading and form fields', () => {
    render(<AddMeeting />, { wrapper: Wrapper });
    expect(screen.getByText('Add Meeting')).toBeInTheDocument();
    expect(screen.getByTestId('project-dropdown')).toBeInTheDocument();
    expect(screen.getByLabelText(/meeting name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meeting url/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/meeting description/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/join now/i)).toBeInTheDocument();
    expect(screen.getByTestId('timezone-field')).toBeInTheDocument();
    expect(screen.getByLabelText(/schedule time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('when Join Now is checked, schedule time and timezone are hidden', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />, { wrapper: Wrapper });
    const joinNowSwitch = screen.getByRole('switch');
    await user.click(joinNowSwitch);
    expect(screen.queryByLabelText(/schedule time/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('timezone-field')).not.toBeInTheDocument();
  });

  it('when Join Now is unchecked, schedule time and timezone are visible', () => {
    render(<AddMeeting />, { wrapper: Wrapper });
    expect(screen.getByLabelText(/schedule time/i)).toBeInTheDocument();
    expect(screen.getByTestId('timezone-field')).toBeInTheDocument();
  });

  it('shows validation error when name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />, { wrapper: Wrapper });
    await user.type(
      screen.getByPlaceholderText(/paste meeting url/i),
      'https://example.com/meet'
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/meeting name is required/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows validation error when url is empty on submit', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />, { wrapper: Wrapper });
    await user.type(
      screen.getByPlaceholderText(/enter meeting name/i),
      'My Meeting'
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/meeting url is required/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows validation error when url does not start with https', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />, { wrapper: Wrapper });
    await user.type(
      screen.getByPlaceholderText(/enter meeting name/i),
      'My Meeting'
    );
    await user.type(
      screen.getByPlaceholderText(/paste meeting url/i),
      'http://example.com/meet'
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Cancel calls replace with /meetings', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockReplace).toHaveBeenCalledWith('/meetings');
  });

  it('valid submit with name and https url does not show validation', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />, { wrapper: Wrapper });
    await user.type(
      screen.getByPlaceholderText(/enter meeting name/i),
      'Test Meeting'
    );
    await user.type(
      screen.getByPlaceholderText(/paste meeting url/i),
      'https://zoom.us/j/123'
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await vi.waitFor(() => {
      expect(
        screen.queryByText(/meeting name is required/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/meeting url is required/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/please enter a valid url/i)
      ).not.toBeInTheDocument();
    });
  });
});

describe('MeetingDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEndMeeting.mockResolvedValue({ message: 'ok', meetingId: '99' });
  });

  it('renders back button, meeting name, platform, status, and metadata', () => {
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    expect(
      screen.getByRole('button', { name: /meetings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Weekly Sync - Product & Engineering')
    ).toBeInTheDocument();
    expect(screen.getByText('ZOOM')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Zuko AI')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('back button calls router.back', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /meetings/i }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows End Meeting button when status is IN_PROGRESS', () => {
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ status: 'IN_PROGRESS' }} />,
      { wrapper: Wrapper }
    );
    expect(
      screen.getByRole('button', { name: /end meeting/i })
    ).toBeInTheDocument();
  });

  it('clicking End Meeting triggers toast', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail
        meetingId="99"
        meetingOverride={{ status: 'IN_PROGRESS' }}
      />,
      { wrapper: Wrapper }
    );
    await user.click(screen.getByRole('button', { name: /end meeting/i }));
    expect(mockToastSuccess).toHaveBeenCalledWith('Meeting ended: 99');
  });

  it('Recording tab shows video and Download link by default', () => {
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    expect(
      screen.getByRole('button', { name: /recording/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /transcript/i })
    ).toBeInTheDocument();
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('src')).toContain('mov_bbb');
    expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument();
  });

  it('shows No recording available when recordingUrl is null', () => {
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ recordingUrl: null }} />,
      { wrapper: Wrapper }
    );
    expect(
      screen.getByText('No recording available for this meeting')
    ).toBeInTheDocument();
  });

  it('Transcript tab shows content', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /transcript/i }));
    expect(
      screen.getByText(/Hello everyone.*start the sync/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/I have some updates on the UI refactor/i)
    ).toBeInTheDocument();
  });

  it('shows No transcript when transcript is empty', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ transcript: [] }} />,
      { wrapper: Wrapper }
    );
    await user.click(screen.getByRole('button', { name: /transcript/i }));
    expect(
      screen.getByText('No transcript available for this meeting')
    ).toBeInTheDocument();
  });

  it('Chat tab shows messages', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /^chat$/i }));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Starting now!')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('I will be 2 mins late.')).toBeInTheDocument();
  });

  it('shows No chat messages when chatMessages is empty', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ chatMessages: [] }} />,
      { wrapper: Wrapper }
    );
    await user.click(screen.getByRole('button', { name: /^chat$/i }));
    expect(
      screen.getByText('No chat messages available for this meeting')
    ).toBeInTheDocument();
  });

  it('Summary tab shows content', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /summary/i }));
    expect(
      screen.getByText(/The team discussed the ongoing UI refactor/i)
    ).toBeInTheDocument();
  });

  it('shows No summary when summary is null', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ summary: null }} />,
      { wrapper: Wrapper }
    );
    await user.click(screen.getByRole('button', { name: /summary/i }));
    expect(
      screen.getByText('No summary available for this meeting')
    ).toBeInTheDocument();
  });

  it('Action Items tab shows list and count', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /action items/i }));
    expect(screen.getByText(/2 of 2 items/)).toBeInTheDocument();
    expect(
      screen.getByText('Review UI refactor components')
    ).toBeInTheDocument();
    expect(screen.getByText('Review API documentation')).toBeInTheDocument();
  });

  it('shows No action items when actionItems is empty', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ actionItems: [] }} />,
      { wrapper: Wrapper }
    );
    await user.click(screen.getByRole('button', { name: /action items/i }));
    expect(
      screen.getByText('No action items for this meeting')
    ).toBeInTheDocument();
  });

  it('action items search filters and shows No results found when no match', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /action items/i }));
    const search = screen.getByPlaceholderText(/search action items/i);
    await user.type(search, 'nonexistentxyz');
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('copy action item button has aria-label and triggers toast', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<MeetingDetail meetingId="1" />, { wrapper: Wrapper });
    await user.click(screen.getByRole('button', { name: /action items/i }));
    const copyButtons = screen.getAllByRole('button', {
      name: /copy action item/i,
    });
    await user.click(copyButtons[0]);
    expect(mockToastSuccess).toHaveBeenCalledWith('Copied to clipboard');
  });
});
