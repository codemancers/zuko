import { redirect } from 'next/navigation';
import Page from '../src/app/page';

vi.mock('next/navigation', () => ({ redirect: vi.fn<(path: string) => void>() }));

describe('Page', () => {
  it('redirects the root to the dashboard', () => {
    Page();
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
