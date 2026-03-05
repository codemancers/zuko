/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateOrg } from '@/components/organization/create-org';

const mockCreate = vi.fn();
const mockSetActive = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    organization: {
      create: (...args: unknown[]) => mockCreate(...args),
      setActive: (...args: unknown[]) => mockSetActive(...args),
    },
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('CreateOrg Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
  });

  it('renders Create Organization heading', () => {
    render(<CreateOrg />);
    expect(screen.getByText('Create Organization')).toBeInTheDocument();
  });

  it('automatically generates a slug from the name', async () => {
    const user = userEvent.setup();
    render(<CreateOrg />);

    const nameInput = screen.getByLabelText(/organization name/i);
    const slugInput = screen.getByLabelText(/organization slug/i);

    await user.type(nameInput, 'My New Org');

    expect(slugInput).toHaveValue('my-new-org');
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<CreateOrg />);

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(submitButton);

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(await screen.findByText('Slug is required')).toBeInTheDocument();
  });

  it('successfully creates an organization and sets it as active', async () => {
    mockCreate.mockResolvedValue({
      data: { id: 'org-123', name: 'Test Org', slug: 'test-org' },
      error: null,
    });
    mockSetActive.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<CreateOrg />);

    await user.type(screen.getByLabelText(/organization name/i), 'Test Org');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Test Org',
        slug: 'test-org',
      });
    });

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({
        organizationId: 'org-123',
      });
    });

    expect(window.location.href).toBe('/chat');
  });

  it('displays error message when slug is already taken (409)', async () => {
    mockCreate.mockResolvedValue({
      data: null,
      error: { status: 409, message: 'Slug already taken' },
    });

    const user = userEvent.setup();
    render(<CreateOrg />);

    await user.type(
      screen.getByLabelText(/organization name/i),
      'Duplicate Org',
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText(/this slug is already taken/i),
    ).toBeInTheDocument();
  });

  it('displays generic error message for other failures', async () => {
    mockCreate.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Database error' },
    });

    const user = userEvent.setup();
    render(<CreateOrg />);

    await user.type(screen.getByLabelText(/organization name/i), 'Error Org');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Database error')).toBeInTheDocument();
  });
});
