import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { RecordEnrichment, companyHint } from './record-enrichment';

const api = vi.hoisted(() => vi.fn<(path: string, init?: RequestInit & { json?: unknown }) => Promise<unknown>>());
vi.mock('@/lib/api', () => ({ api }));

beforeEach(() => {
  api.mockReset();
});

describe('companyHint', () => {
  it('reads a website as a domain and anything else as a name', () => {
    expect(companyHint('openai.com')).toEqual({ domain: 'openai.com' });
    expect(companyHint('https://openai.com/about')).toEqual({ domain: 'https://openai.com/about' });
    expect(companyHint('Open AI')).toEqual({ organization_name: 'Open AI' });
    expect(companyHint('  ')).toEqual({});
  });
});

describe('RecordEnrichment', () => {
  it('sends the company with the request and reports what was filled and left alone', async () => {
    api.mockImplementation(async (path, init) => {
      if (path === '/api/v1/me') return { can_enrich_records: true };
      if (init?.method === 'POST')
        return { matched: true, applied: ['job_title'], skipped: [{ field: 'first_name', reason: 'ALREADY_SET' }] };
      return { results: [] };
    });
    const onChanged = vi.fn<() => void>();
    render(<RecordEnrichment object="prospect" recordId="7" onChanged={onChanged} />);

    fireEvent.change(await screen.findByLabelText('Company website or name'), { target: { value: 'openai.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enrich with Apollo' }));

    expect(await screen.findByText('Filled in: job_title.')).toBeTruthy();
    expect(screen.getByText(/first_name \(already has a value\)/)).toBeTruthy();
    expect(api).toHaveBeenCalledWith(
      '/api/v1/objects/prospect/records/7/enrich',
      expect.objectContaining({ method: 'POST', json: { domain: 'openai.com' } }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('shows the server reason, and has no company box for a company', async () => {
    api.mockImplementation(async (path, init) => {
      if (init?.method === 'POST') throw new Error('Apollo is not connected. An admin can connect it in Settings.');
      return path === '/api/v1/me' ? { can_enrich_records: true } : { results: [] };
    });
    render(<RecordEnrichment object="company" recordId="3" onChanged={() => undefined} />);
    expect(screen.queryByLabelText('Company website or name')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Enrich with Apollo' }));
    expect(await screen.findByText(/Apollo is not connected/)).toBeTruthy();
  });
});
