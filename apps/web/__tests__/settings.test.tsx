/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SettingsPage from '@/app/(app)/settings/page';
import ConnectGitHub from '@/components/Settings/ConnectGitHub';
import InstallGitHubApp from '@/components/Settings/InstallGitHubApp';

const mockListAccounts = vi.fn();
const mockLinkSocial = vi.fn();
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    linkSocial: (...args: unknown[]) => mockLinkSocial(...args),
  },
}));

const mockGetGitHubInstallationStatus = vi.fn();
const mockGetGitHubInstallationUrl = vi.fn();
vi.mock('@/server/actions/github', () => ({
  getGitHubInstallationStatus: () => mockGetGitHubInstallationStatus(),
  getGitHubInstallationUrl: () => mockGetGitHubInstallationUrl(),
}));

describe('SettingsPage', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders Settings heading and description', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accounts: [] }),
    } as Response);

    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(
      screen.getByText(/manage your integrations and connected accounts/i)
    ).toBeInTheDocument();
  });

  it('renders Integrations and Connections sections', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accounts: [] }),
    } as Response);

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Integrations')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/install apps to extend functionality/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();
    expect(
      screen.getByText(/connect your accounts for authentication and data access/i)
    ).toBeInTheDocument();
  });

  it('renders GitHub in Integrations and Google Calendar in Connections', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accounts: [] }),
    } as Response);

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('GitHub App')).toBeInTheDocument();
    });
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(
      screen.getByText(/sync events and availability for scheduling/i)
    ).toBeInTheDocument();
  });

  it('shows Connected badge for Google when accounts include google', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          accounts: [{ providerId: 'google' }],
        }),
    } as Response);

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    });
    const connectedBadges = screen.getAllByText('Connected');
    expect(connectedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Not connected when no accounts', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accounts: [] }),
    } as Response);

    render(<SettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Connections')).toBeInTheDocument();
    });
    const notConnected = screen.getAllByText('Not connected');
    expect(notConnected.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ConnectGitHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton initially', () => {
    mockListAccounts.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    render(<ConnectGitHub />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows GitHub and Connected badge when listAccounts returns github', async () => {
    mockListAccounts.mockResolvedValue({
      data: [{ providerId: 'github' }],
    });
    render(<ConnectGitHub />);
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(
      screen.getByText(/your github account is connected for authentication/i)
    ).toBeInTheDocument();
  });

  it('shows Connect button when not connected', async () => {
    mockListAccounts.mockResolvedValue({ data: [] });
    render(<ConnectGitHub />);
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/connect github for authentication and profile access/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /connect/i })
    ).toBeInTheDocument();
  });

  it('calls linkSocial when Connect is clicked', async () => {
    mockListAccounts.mockResolvedValue({ data: [] });
    mockLinkSocial.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ConnectGitHub />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(mockLinkSocial).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        callbackURL: expect.any(String),
      })
    );
  });

  it('shows Connecting... while linkSocial is in progress', async () => {
    let resolveLink: () => void = () => {
      /* noop until Promise constructor runs */
    };
    mockListAccounts.mockResolvedValue({ data: [] });
    mockLinkSocial.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLink = resolve;
        })
    );
    const user = userEvent.setup();
    render(<ConnectGitHub />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^connect$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connecting/i })).toBeInTheDocument();
    });
    if (resolveLink) resolveLink();
  });
});

describe('InstallGitHubApp', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Replace location for test so we can assert redirect (window.location.href)
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('shows loading skeleton initially', () => {
    mockGetGitHubInstallationStatus.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
    render(<InstallGitHubApp />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows Installed badge and account when status.installed is true', async () => {
    mockGetGitHubInstallationStatus.mockResolvedValue({
      installed: true,
      installation: { accountLogin: 'my-org' },
    });
    render(<InstallGitHubApp />);
    await waitFor(() => {
      expect(screen.getByText('GitHub App')).toBeInTheDocument();
    });
    expect(screen.getByText('Installed')).toBeInTheDocument();
    expect(screen.getByText('my-org')).toBeInTheDocument();
    expect(
      screen.getByText(/the github app is ready to manage tasks/i)
    ).toBeInTheDocument();
  });

  it('shows Install button when not installed', async () => {
    mockGetGitHubInstallationStatus.mockResolvedValue({
      installed: false,
      installation: null,
    });
    render(<InstallGitHubApp />);
    await waitFor(() => {
      expect(screen.getByText('GitHub App')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/install the github app to enable task management/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^install$/i })
    ).toBeInTheDocument();
  });

  it('shows Re-install button when installed', async () => {
    mockGetGitHubInstallationStatus.mockResolvedValue({
      installed: true,
      installation: { accountLogin: 'org' },
    });
    render(<InstallGitHubApp />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /re-install/i })).toBeInTheDocument();
    });
  });

  it('redirects to installation URL when Install is clicked', async () => {
    mockGetGitHubInstallationStatus.mockResolvedValue({
      installed: false,
      installation: null,
    });
    mockGetGitHubInstallationUrl.mockResolvedValue({
      url: 'https://github.com/apps/my-app/installations/new',
    });
    const user = userEvent.setup();
    render(<InstallGitHubApp />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^install$/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^install$/i }));
    await waitFor(() => {
      expect(window.location.href).toBe(
        'https://github.com/apps/my-app/installations/new'
      );
    });
  });
});
