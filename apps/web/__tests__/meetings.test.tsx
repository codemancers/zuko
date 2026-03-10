/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MeetingList } from '@/components/meeting/meeting-list';
import AddMeeting from '@/components/meeting/add-meeting';
import MeetingDetail from '@/components/meeting/meeting-detail';

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
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe('MeetingList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Meetings heading, search, sort, and Add to a meeting button', () => {
    render(<MeetingList />);
    expect(screen.getByText('Meetings')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search meetings...')
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('date');
    expect(
      screen.getByRole('link', { name: /add to a meeting/i })
    ).toHaveAttribute('href', '/meeting/add');
  });

  it('shows meeting names from default data', () => {
    render(<MeetingList />);
    expect(screen.getByText('Weekly Product Sync')).toBeInTheDocument();
    expect(screen.getByText('Q1 Roadmap Planning')).toBeInTheDocument();
    expect(screen.getByText('Frontend Performance Review')).toBeInTheDocument();
  });

  it('filters meetings by search (case-insensitive)', async () => {
    const user = userEvent.setup();
    render(<MeetingList />);
    const search = screen.getByPlaceholderText('Search meetings...');
    await user.type(search, 'product');
    expect(screen.getByText('Weekly Product Sync')).toBeInTheDocument();
    expect(screen.queryByText('Q1 Roadmap Planning')).not.toBeInTheDocument();
  });

  it('sorts by name when sort select is name', async () => {
    const user = userEvent.setup();
    render(<MeetingList />);
    await user.selectOptions(screen.getByRole('combobox'), 'name');
    const items = screen.getAllByRole('listitem');
    const firstHeading = within(items[0]).getByText(/Frontend Performance Review/);
    expect(firstHeading).toBeInTheDocument();
  });

  it('sorts by date when sort select is date', async () => {
    const user = userEvent.setup();
    render(<MeetingList />);
    await user.selectOptions(screen.getByRole('combobox'), 'date');
    expect(screen.getByRole('combobox')).toHaveValue('date');
  });

  it('navigates to meeting detail when row is clicked', async () => {
    const user = userEvent.setup();
    render(<MeetingList />);
    await user.click(screen.getByText('Weekly Product Sync'));
    expect(mockPush).toHaveBeenCalledWith('/meeting/1');
  });

  it('Add to a meeting link goes to /meeting/add', () => {
    render(<MeetingList />);
    const link = screen.getByRole('link', { name: /add to a meeting/i });
    expect(link).toHaveAttribute('href', '/meeting/add');
  });

  it('opens dropdown and View link has correct href', async () => {
    const user = userEvent.setup();
    render(<MeetingList />);
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[1]);
    const viewItem = await screen.findByRole('menuitem', { name: /view/i }, { timeout: 3000 });
    expect(viewItem).toHaveAttribute('href', '/meeting/1');
  });

  it('opens delete dialog when Delete is clicked', async () => {
    const user = userEvent.setup();
    render(<MeetingList />);
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
    render(<MeetingList />);
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
    render(<MeetingList />);
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
    render(<AddMeeting />);
    expect(screen.getByText('Add Meeting')).toBeInTheDocument();
    expect(screen.getByTestId('project-dropdown')).toBeInTheDocument();
    expect(screen.getByLabelText(/meeting name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/meeting url/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/meeting description/i)
    ).toBeInTheDocument();
    // Join Now toggle
    expect(screen.getByText(/join now/i)).toBeInTheDocument();
    expect(screen.getByTestId('timezone-field')).toBeInTheDocument();
    expect(screen.getByLabelText(/schedule time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('when Join Now is checked, schedule time and timezone are hidden', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />);
    const joinNowSwitch = screen.getByRole('switch');
    await user.click(joinNowSwitch);
    expect(screen.queryByLabelText(/schedule time/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('timezone-field')).not.toBeInTheDocument();
  });

  it('when Join Now is unchecked, schedule time and timezone are visible', () => {
    render(<AddMeeting />);
    expect(screen.getByLabelText(/schedule time/i)).toBeInTheDocument();
    expect(screen.getByTestId('timezone-field')).toBeInTheDocument();
  });

  it('shows validation error when name is empty on submit', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />);
    await user.type(screen.getByPlaceholderText(/paste meeting url/i), 'https://example.com/meet');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/meeting name is required/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows validation error when url is empty on submit', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />);
    await user.type(screen.getByPlaceholderText(/enter meeting name/i), 'My Meeting');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/meeting url is required/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows validation error when url does not start with https', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />);
    await user.type(screen.getByPlaceholderText(/enter meeting name/i), 'My Meeting');
    await user.type(screen.getByPlaceholderText(/paste meeting url/i), 'http://example.com/meet');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('Cancel calls replace with /meetings', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockReplace).toHaveBeenCalledWith('/meetings');
  });

  it('valid submit with name and https url does not show validation', async () => {
    const user = userEvent.setup();
    render(<AddMeeting />);
    await user.type(screen.getByPlaceholderText(/enter meeting name/i), 'Test Meeting');
    await user.type(screen.getByPlaceholderText(/paste meeting url/i), 'https://zoom.us/j/123');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await vi.waitFor(() => {
      expect(screen.queryByText(/meeting name is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/meeting url is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/please enter a valid url/i)).not.toBeInTheDocument();
    });
  });
});

describe('MeetingDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders back button, meeting name, platform, status, and metadata', () => {
    render(<MeetingDetail meetingId="1" />);
    expect(screen.getByRole('button', { name: /meetings/i })).toBeInTheDocument();
    expect(screen.getByText('Weekly Sync - Product & Engineering')).toBeInTheDocument();
    expect(screen.getByText('ZOOM')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Zuko AI')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('back button calls router.back', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />);
    await user.click(screen.getByRole('button', { name: /meetings/i }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows End Meeting button when status is IN_PROGRESS', () => {
    render(
      <MeetingDetail
        meetingId="1"
        meetingOverride={{ status: 'IN_PROGRESS' }}
      />
    );
    expect(screen.getByRole('button', { name: /end meeting/i })).toBeInTheDocument();
  });

  it('clicking End Meeting triggers toast', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail
        meetingId="99"
        meetingOverride={{ status: 'IN_PROGRESS' }}
      />
    );
    await user.click(screen.getByRole('button', { name: /end meeting/i }));
    expect(mockToastSuccess).toHaveBeenCalledWith('Meeting ended: 99');
  });

  it('Recording tab shows video and Download link by default', () => {
    render(<MeetingDetail meetingId="1" />);
    expect(screen.getByRole('button', { name: /recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /transcript/i })).toBeInTheDocument();
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('src')).toContain('mov_bbb');
    expect(screen.getByRole('link', { name: /download/i })).toBeInTheDocument();
  });

  it('shows No recording available when recordingUrl is null', () => {
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ recordingUrl: null } } />
    );
    expect(screen.getByText('No recording available for this meeting')).toBeInTheDocument();
  });

  it('Transcript tab shows content', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />);
    await user.click(screen.getByRole('button', { name: /transcript/i }));
    expect(screen.getByText(/Hello everyone.*start the sync/i)).toBeInTheDocument();
    expect(screen.getByText(/I have some updates on the UI refactor/i)).toBeInTheDocument();
  });

  it('shows No transcript when transcript is empty', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ transcript: [] } } />
    );
    await user.click(screen.getByRole('button', { name: /transcript/i }));
    expect(screen.getByText('No transcript available for this meeting')).toBeInTheDocument();
  });

  it('Chat tab shows messages', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />);
    await user.click(screen.getByRole('button', { name: /^chat$/i }));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Starting now!')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('I will be 2 mins late.')).toBeInTheDocument();
  });

  it('shows No chat messages when chatMessages is empty', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ chatMessages: [] } } />
    );
    await user.click(screen.getByRole('button', { name: /^chat$/i }));
    expect(screen.getByText('No chat messages available for this meeting')).toBeInTheDocument();
  });

  it('Summary tab shows content', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />);
    await user.click(screen.getByRole('button', { name: /summary/i }));
    expect(
      screen.getByText(/The team discussed the ongoing UI refactor/i)
    ).toBeInTheDocument();
  });

  it('shows No summary when summary is null', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ summary: null } } />
    );
    await user.click(screen.getByRole('button', { name: /summary/i }));
    expect(screen.getByText('No summary available for this meeting')).toBeInTheDocument();
  });

  it('Action Items tab shows list and count', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />);
    await user.click(screen.getByRole('button', { name: /action items/i }));
    expect(screen.getByText(/2 of 2 items/)).toBeInTheDocument();
    expect(screen.getByText('Review UI refactor components')).toBeInTheDocument();
    expect(screen.getByText('Setup Asana integration')).toBeInTheDocument();
  });

  it('shows No action items when actionItems is empty', async () => {
    const user = userEvent.setup();
    render(
      <MeetingDetail meetingId="1" meetingOverride={{ actionItems: [] } } />
    );
    await user.click(screen.getByRole('button', { name: /action items/i }));
    expect(screen.getByText('No action items for this meeting')).toBeInTheDocument();
  });

  it('action items search filters and shows No results found when no match', async () => {
    const user = userEvent.setup();
    render(<MeetingDetail meetingId="1" />);
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
    render(<MeetingDetail meetingId="1" />);
    await user.click(screen.getByRole('button', { name: /action items/i }));
    const copyButtons = screen.getAllByRole('button', {
      name: /copy action item/i,
    });
    await user.click(copyButtons[0]);
    expect(mockToastSuccess).toHaveBeenCalledWith('Copied to clipboard');
  });
});
