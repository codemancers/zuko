import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { ApiError } from '@/lib/api';
import { RecordTimeline } from './record-timeline';
import type { CommentItem } from '@/lib/activity';
import type { AttachedFile } from '@/lib/files';

const mocks = vi.hoisted(() => ({
  api: vi.fn<(path: string, init?: { method?: string; json?: Record<string, unknown> }) => Promise<unknown>>(),
  uploadFile: vi.fn<(file: File) => Promise<AttachedFile>>(),
}));
vi.mock('@/lib/api', () => ({
  api: mocks.api,
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
}));
vi.mock('@/lib/files', async (original) => ({
  ...(await original<typeof import('@/lib/files')>()),
  uploadFile: mocks.uploadFile,
}));

const base = '/api/v1/objects/contact/records/5';
const pdf: AttachedFile = { id: '11', filename: 'contract.pdf', media_type: 'application/pdf', size: 2048 };
const png: AttachedFile = { id: '12', filename: 'photo.png', media_type: 'image/png', size: 900 };
const def = { name: 'contact', fields: [], associations: [] };
const comment = (over: Partial<CommentItem> = {}): CommentItem => ({
  type: 'comment',
  id: '1',
  record_id: '5',
  body: 'See attached',
  mentions: [],
  files: [],
  actor_type: 'USER',
  actor_id: '7',
  actor_name: 'Me',
  edited_at: null,
  created_at: '2026-11-20T09:00:00.000Z',
  ...over,
});

function setup(items: CommentItem[] = [], post?: () => Promise<unknown>) {
  mocks.api.mockImplementation(async (path, init) => {
    if (path === '/api/v1/me') return { user_id: '7' };
    if (path.startsWith(`${base}/activity`)) return { results: items, next_before: null };
    if (path === `${base}/comments` && init?.method === 'POST') return post ? post() : {};
    return {};
  });
  return render(<RecordTimeline def={def} recordId="5" version="1" members={[]} />);
}
const posts = () => mocks.api.mock.calls.filter(([path, init]) => path === `${base}/comments` && init?.method === 'POST');
const attach = async (...files: File[]) => {
  await screen.findByLabelText('Add a comment');
  fireEvent.change(screen.getAllByTestId('file-input')[0]!, { target: { files } });
};
const file = (name: string) => new File(['x'], name, { type: 'application/pdf' });

beforeEach(() => {
  mocks.api.mockReset();
  mocks.uploadFile.mockReset();
});

describe('the comment composer', () => {
  it('posts a file with no text, by id, then clears', async () => {
    mocks.uploadFile.mockResolvedValue(pdf);
    setup();
    await attach(file('contract.pdf'));
    expect((await screen.findByRole('list', { name: 'Files to attach' })).textContent).toContain('contract.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]![1]!.json).toEqual({ body: '', mentions: [], files: ['11'] });
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Files to attach' })).toBeNull());
  });

  it('posts text with several files, in order', async () => {
    mocks.uploadFile.mockResolvedValueOnce(pdf).mockResolvedValueOnce(png);
    setup();
    await screen.findByLabelText('Add a comment');
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: ' Notes ' } });
    await attach(file('contract.pdf'), file('photo.png'));
    await screen.findByText('photo.png');
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]![1]!.json).toEqual({ body: 'Notes', mentions: [], files: ['11', '12'] });
  });

  it('cannot send nothing, and lets an attached file be removed before sending', async () => {
    mocks.uploadFile.mockResolvedValue(pdf);
    setup();
    await screen.findByLabelText('Add a comment');
    const send = screen.getByRole('button', { name: 'Comment' });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    await attach(file('contract.pdf'));
    await screen.findByText('contract.pdf');
    expect((send as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove contract.pdf' }));
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps the text and the files, and shows the reason, when the server refuses', async () => {
    mocks.uploadFile.mockResolvedValue(pdf);
    setup([], () => Promise.reject(new ApiError("Field 'files' names a file that you cannot access", 400)));
    await screen.findByLabelText('Add a comment');
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: 'Hello' } });
    await attach(file('contract.pdf'));
    await screen.findByText('contract.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect((await screen.findByRole('alert')).textContent).toContain('you cannot access');
    expect((screen.getByLabelText('Add a comment') as HTMLTextAreaElement).value).toBe('Hello');
    expect(screen.getByRole('list', { name: 'Files to attach' }).textContent).toContain('contract.pdf');
  });

  it('shows why an upload failed and still attaches the files that did upload', async () => {
    mocks.uploadFile.mockResolvedValueOnce(pdf).mockRejectedValueOnce(new Error('Files must be 25 MB or smaller'));
    setup();
    await attach(file('contract.pdf'), file('big.bin'));
    expect((await screen.findByRole('alert')).textContent).toContain('big.bin: Files must be 25 MB or smaller');
    expect(screen.getByRole('list', { name: 'Files to attach' }).textContent).toContain('contract.pdf');
  });
});

describe('comments with files', () => {
  it('shows each file as a link that opens in a new tab', async () => {
    setup([comment({ files: [pdf, png] })]);
    const list = await screen.findByRole('list', { name: 'Attached files' });
    const link = screen.getByRole('link', { name: 'contract.pdf' });
    expect(list.contains(link)).toBe(true);
    expect(link.getAttribute('href')).toMatch(/\/api\/v1\/files\/11\/content$/);
    expect(link.getAttribute('target')).toEqual('_blank');
    expect(link.getAttribute('rel')).toEqual(expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: 'photo.png' })).toBeTruthy();
  });

  it('shows a comment that is only a file without an empty text block', async () => {
    setup([comment({ body: '', files: [pdf] })]);
    expect(await screen.findByRole('link', { name: 'contract.pdf' })).toBeTruthy();
  });

  it('does not send the files when only the text is edited', async () => {
    setup([comment({ files: [pdf] })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit comment'), { target: { value: 'New words' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(mocks.api.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
    const patch = mocks.api.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(patch[1]!.json).toEqual({ body: 'New words', mentions: [] });
  });

  it('sends the new list when the author removes a file', async () => {
    setup([comment({ files: [pdf, png] })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove contract.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save comment' }));
    await waitFor(() => expect(mocks.api.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true));
    const patch = mocks.api.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(patch[1]!.json).toEqual({ body: 'See attached', mentions: [], files: ['12'] });
  });

  it('lets a comment keep only files once its text is cleared, but not be saved empty', async () => {
    setup([comment({ files: [pdf] })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit comment'), { target: { value: '' } });
    expect((screen.getByRole('button', { name: 'Save comment' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove contract.pdf' }));
    expect((screen.getByRole('button', { name: 'Save comment' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
