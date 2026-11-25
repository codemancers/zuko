import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { auth, resetAuth } from '@/test/auth-mock';
import { Consent } from './consent';

vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

const QUERY =
  '?client_id=client_1&scope=openid+records%3Aread+records%3Awrite+records%3Adelete+schema%3Aread+directory%3Aread&sig=abc&state=s';
const signedIn = { data: { user: { id: 'u' } }, isPending: false };
const navigate = vi.fn<(url: string) => void>();

function open(search = QUERY) {
  window.history.pushState({}, '', `/consent${search}`);
  return render(<Consent navigate={navigate} />);
}

beforeEach(() => {
  resetAuth();
  navigate.mockReset();
  auth.session = signedIn;
  auth.activeOrg = { data: { id: 'org_1', name: 'Acme' }, isPending: false };
  auth.fetch.mockImplementation(async (path: string) =>
    path === '/oauth2/public-client'
      ? { data: { client_id: 'client_1', client_name: 'Claude' }, error: null }
      : { data: { redirect: true, url: 'http://localhost:9999/callback?code=c' }, error: null },
  );
});

describe('Consent', () => {
  it('names the application, the organization and what it will be able to do', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Connect Claude' })).toBeTruthy();
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByText('View records, their relationships and change history')).toBeTruthy();
    expect(screen.getByText('View object types, fields and relationship definitions')).toBeTruthy();
    expect(screen.getByText('View organization members and teams')).toBeTruthy();
    expect(screen.getByText('Create and change records')).toBeTruthy();
    expect(screen.getByText('Delete records')).toBeTruthy();
    expect(auth.fetch).toHaveBeenCalledWith('/oauth2/public-client', {
      query: { client_id: 'client_1' },
    });
  });

  it('sends the person back to the application once they allow it', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('http://localhost:9999/callback?code=c'),
    );
    expect(auth.fetch).toHaveBeenCalledWith('/oauth2/consent', {
      method: 'POST',
      body: { accept: true },
    });
  });

  it('tells the application when they cancel', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(auth.fetch).toHaveBeenCalledWith('/oauth2/consent', {
        method: 'POST',
        body: { accept: false },
      }),
    );
    expect(navigate).toHaveBeenCalled();
  });

  it('shows what went wrong and lets them try again', async () => {
    auth.fetch.mockImplementation(async (path: string) =>
      path === '/oauth2/public-client'
        ? { data: { client_id: 'client_1', client_name: 'Claude' }, error: null }
        : { data: null, error: { message: 'Select or create an organization first' } },
    );
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));

    expect(await screen.findByText('Select or create an organization first')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Allow' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('will not allow a connection with no organization to bind it to', async () => {
    auth.activeOrg = { data: null, isPending: false };
    open();

    expect(await screen.findByText(/You need an organization first/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Allow' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('asks a signed-out visitor to log in, keeping the signed request in the link', async () => {
    auth.session = { data: null, isPending: false };
    open();

    const link = await screen.findByRole('link', { name: 'Log in' });
    expect(link.getAttribute('href')).toBe(`/login${QUERY}`);
    expect(auth.fetch).not.toHaveBeenCalled();
  });

  it('rejects a link that is not a signed authorization request', async () => {
    open('?client_id=client_1&scope=records%3Aread');

    expect(await screen.findByRole('heading', { name: 'This link is not valid' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Allow' })).toBeNull();
  });

  it('shows an unknown application as an error but still names it generically', async () => {
    auth.fetch.mockImplementation(async (path: string) =>
      path === '/oauth2/public-client'
        ? { data: null, error: { message: 'Not found' } }
        : { data: {}, error: null },
    );
    open();

    expect(await screen.findByText('Not found')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Connect An application' })).toBeTruthy();
  });
});
