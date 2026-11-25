import { GET } from './route';

const sdk = vi.hoisted(() => ({ setupRun: vi.fn<(runId: string) => unknown>() }));
vi.mock('@/lib/workflow', () => sdk);
const params = { params: Promise.resolve({ organizationId: '1' }) };
const request = (json = false) => new Request('http://localhost:4200/api/organizations/1/setup', {
  headers: { cookie: 'session=test', ...(json ? { Accept: 'application/json' } : {}) },
});
beforeEach(() => {
  sdk.setupRun.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: '1', setupRunId: null })));
});

it('reports unattached setup as pending for both snapshots and reconnecting EventSource clients', async () => {
  expect((await (await GET(request(true), params)).json()).status).toBe('running');
  const response = await GET(request(), params);
  expect(await response.text()).toContain('"status":"running"');
  expect(sdk.setupRun).not.toHaveBeenCalled();
});

it('restores the failed step and reason from the persisted SDK stream', async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ id: '1', setupRunId: 'run' }));
  const progress = 'data: {"status":"failed","step":"crm","message":"Custom object conflict"}\n\n';
  const stream = Object.assign(new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(progress));
    controller.close();
  } }), { getTailIndex: async () => 2 });
  sdk.setupRun.mockReturnValue({ status: Promise.resolve('failed'), getReadable: () => stream });
  const response = await GET(request(), params);
  expect(await response.text()).toBe(progress);
});

it('uses a terminal failure for older runs that have no persisted progress', async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ id: '1', setupRunId: 'run' }));
  sdk.setupRun.mockReturnValue({ status: Promise.resolve('failed'), getReadable: () => ({ getTailIndex: async () => -1 }) });
  expect(await (await GET(request(), params)).text()).toContain('"status":"failed"');
});

it('does not read a run when organization membership is denied', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 403 }));
  expect((await GET(request(), params)).status).toBe(403);
  expect(sdk.setupRun).not.toHaveBeenCalled();
});
