import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpSetupModal } from '@/components/organization/mcp-setup-modal';

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

describe('McpSetupModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('masks the visible token and copies the real token', async () => {
    const user = userEvent.setup();
    const token = 'njpIEZVCFpTBKLvLJDRSQGbmiGKssioq';

    render(
      <McpSetupModal
        open
        onClose={() => undefined}
        endpoint="http://localhost:3001/api/mcp"
        token={token}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Codex CLI' }));

    expect(
      screen.getByText(/Authorization = "Bearer \*{11}"/),
    ).toBeInTheDocument();
    expect(screen.queryByText(token)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await navigator.clipboard.readText()).toBe(
      `[mcp_servers.ZukoCRM]\n  url = "http://localhost:3001/api/mcp"\n  [mcp_servers.ZukoCRM.headers]\n    Authorization = "Bearer ${token}"`,
    );
  });
});
