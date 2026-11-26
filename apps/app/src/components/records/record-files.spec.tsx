import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/render';
import { RecordFiles } from './record-files';
import type { AttachedFile } from '@/lib/files';
import type { FieldDef } from '@/lib/records';

const mocks = vi.hoisted(() => ({
  api: vi.fn<(path: string, init?: { method?: string; json?: { properties: Record<string, unknown> } }) => Promise<unknown>>(),
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
const named = (id: string): AttachedFile => ({ id, filename: `file-${id}.pdf`, media_type: 'application/pdf', size: 10 });
const photos = { name: 'photos', label: 'Photos', type: 'FILE', config: { many: true }, read_only: false } as unknown as FieldDef;
const contract = { name: 'contract', label: 'Contract', type: 'FILE', config: {}, read_only: false } as unknown as FieldDef;
const patches = () => mocks.api.mock.calls.filter(([, init]) => init?.method === 'PATCH').map(([, init]) => init!.json!.properties);

/** A server that holds what it is sent, and a parent whose copy of the record never refreshes. */
function setup(fields: FieldDef[]) {
  let saved = 0;
  mocks.api.mockImplementation(async (path, init) => {
    if (path === `${base}/files`) return { results: [] };
    if (init?.method === 'PATCH') {
      saved += 1;
      const properties = Object.fromEntries(
        Object.entries(init.json!.properties).map(([name, value]) => [name, Array.isArray(value) ? value.map(named) : value ? named(String(value)) : undefined]),
      );
      return { id: '5', properties, updated_at: `2026-11-26T10:00:0${saved}.000Z` };
    }
    return {};
  });
  return render(<RecordFiles object="contact" recordId="5" fields={fields} properties={{}} version="2026-11-26T09:00:00.000Z" onChanged={() => undefined} />);
}
const attach = async (label: string, id: string) => {
  mocks.uploadFile.mockResolvedValueOnce(named(id));
  const input = (await screen.findByLabelText(label, { selector: 'input' })) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], `${id}.pdf`)] } });
  await screen.findByText(`file-${id}.pdf`, { selector: 'a', exact: true }, { timeout: 3000 }).catch(() => undefined);
};

beforeEach(() => {
  mocks.api.mockReset();
  mocks.uploadFile.mockReset();
});

describe('RecordFiles', () => {
  it('builds each edit from the last save, so attaching A and then B keeps A', async () => {
    setup([photos]);
    await attach('Attach to Photos', 'A');
    await waitFor(() => expect(patches()).toHaveLength(1));
    await screen.findByRole('link', { name: 'file-A.pdf' });
    await attach('Attach to Photos', 'B');
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()).toEqual([{ photos: ['A'] }, { photos: ['A', 'B'] }]);
  });

  it('removes from what was last saved, not from a stale copy', async () => {
    setup([photos]);
    await attach('Attach to Photos', 'A');
    await screen.findByRole('link', { name: 'file-A.pdf' });
    await attach('Attach to Photos', 'B');
    await screen.findByRole('link', { name: 'file-B.pdf' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove file-A.pdf' }));
    await waitFor(() => expect(patches()).toHaveLength(3));
    expect(patches()[2]).toEqual({ photos: ['B'] });
  });

  it('replaces the one file of a single-file field', async () => {
    setup([contract]);
    await attach('Attach to Contract', 'A');
    await screen.findByRole('link', { name: 'file-A.pdf' });
    await attach('Attach to Contract', 'B');
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()).toEqual([{ contract: 'A' }, { contract: 'B' }]);
  });

  it('prefers the parent\'s copy once it is newer than the last save', async () => {
    const { rerender } = setup([photos]);
    await attach('Attach to Photos', 'A');
    await screen.findByRole('link', { name: 'file-A.pdf' });
    rerender(
      <RecordFiles object="contact" recordId="5" fields={[photos]} properties={{ photos: [named('C')] }} version="2026-11-26T11:00:00.000Z" onChanged={() => undefined} />,
    );
    await screen.findByRole('link', { name: 'file-C.pdf' });
    expect(screen.queryByRole('link', { name: 'file-A.pdf' })).toBeNull();
  });
});
