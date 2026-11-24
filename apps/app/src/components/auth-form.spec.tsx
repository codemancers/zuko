import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { auth, resetAuth } from '@/test/auth-mock';
import { AuthForm } from './auth-form';

const router = vi.hoisted(() => ({
  push: vi.fn<(path: string) => void>(),
  replace: vi.fn<(path: string) => void>(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/auth-client', async () => (await import('@/test/auth-mock')).authClientModule);

const assign = vi.fn<(url: string) => void>();

beforeEach(() => {
  resetAuth();
  router.push.mockReset();
  assign.mockReset();
  vi.stubGlobal('location', {
    ...window.location,
    assign,
    get search() {
      return currentSearch;
    },
  });
  currentSearch = '';
});
afterEach(() => vi.unstubAllGlobals());

let currentSearch = '';

function logIn() {
  render(<AuthForm mode="login" />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.com' } });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'correct-horse-battery-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('AuthForm after a successful login', () => {
  it('goes to the dashboard by default', async () => {
    auth.signInEmail.mockResolvedValue({ data: { redirect: false }, error: null });
    logIn();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/dashboard'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('honours a safe ?next= path', async () => {
    currentSearch = '?next=%2Forg%2Fsettings';
    auth.signInEmail.mockResolvedValue({ data: { redirect: false }, error: null });
    logIn();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/org/settings'));
  });

  it('resumes the OAuth flow when an application sent the person here', async () => {
    currentSearch = '?client_id=c&scope=mcp%3Aread&sig=abc';
    auth.signInEmail.mockResolvedValue({
      data: { redirect: true, url: 'http://localhost:4200/consent?client_id=c&sig=abc' },
      error: null,
    });
    logIn();

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('http://localhost:4200/consent?client_id=c&sig=abc'),
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the error and stays put when login fails', async () => {
    auth.signInEmail.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email or password' },
    });
    logIn();

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
