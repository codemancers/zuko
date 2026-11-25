import { setupRun } from '@/lib/workflow';

export const runtime = 'nodejs';
const streamHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};
const event = (request: Request, status: string, message: string) =>
  request.headers.get('accept')?.includes('application/json')
    ? Response.json({ status, message }, { headers: { 'Cache-Control': 'no-store' } })
    : new Response(`data: ${JSON.stringify({ status, message })}\n\n`, { headers: streamHeaders });

/**
 * Authorize organization membership, then forward the SDK's durable progress stream.
 * SDK webhook routes resume workflows from external callbacks; they do not serve
 * authenticated browser progress. Postgres jobs run in process, so SDK execution
 * routes stay private. The switcher requests one JSON snapshot; only the setup
 * page subscribes to the durable stream and reconnects when needed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;
  if (!/^[1-9]\d{0,18}$/.test(organizationId))
    return new Response('Invalid organization', { status: 400 });
  const backend = process.env.BACKEND_URL || 'http://localhost:3000';
  const organization = await fetch(
    `${backend}/auth/organization/get-full-organization?organizationId=${organizationId}`,
    {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
      signal: request.signal,
    },
  );
  if (!organization.ok) return new Response(null, { status: organization.status });
  const data = (await organization.json()) as { id: string; setupRunId?: string | null };
  if (String(data.id) !== organizationId) return new Response(null, { status: 403 });
  if (!data.setupRunId)
    // EventSource reconnects to this finite pending response until reconciliation attaches a run.
    return event(request, 'running', 'Waiting for organization setup to start…');
  try {
    const run = setupRun(data.setupRunId);
    const status = await run.status;
    if (status === 'completed') return event(request, 'ready', 'Your organization is ready.');
    if (status === 'failed' && !request.headers.get('accept')?.includes('application/json')) {
      // Replay the persisted failure (including its step) instead of losing the timeline on refresh.
      const stream = run.getReadable<Uint8Array>({ startIndex: -1 });
      if ((await stream.getTailIndex()) >= 0) return new Response(stream, { headers: streamHeaders });
    }
    if (status === 'failed' || status === 'cancelled')
      return event(request, 'failed', 'Setup could not finish. Please contact your administrator.');
    if (request.headers.get('accept')?.includes('application/json'))
      return event(request, 'running', 'Your organization is still being set up.');
    return new Response(run.getReadable<Uint8Array>({ startIndex: -1 }), {
      headers: streamHeaders,
    });
  } catch (error) {
    console.error('Could not read organization setup stream', error);
    if (request.headers.get('accept')?.includes('application/json'))
      return Response.json({ message: 'Setup progress is temporarily unavailable.' }, { status: 503 });
    return event(request, 'running', 'Setup progress is temporarily unavailable. Reconnecting…');
  }
}
