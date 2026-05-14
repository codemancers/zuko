import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * Dedicated SSE proxy for sandbox lifecycle events.
 * The generic /api/proxy/[...path] route calls response.json() which buffers
 * the response body and breaks server-sent events. This route streams the
 * response body directly to the browser.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(
    `${BACKEND_URL}/api/sandboxes/${id}/lifecycle/events`,
    {
      headers: {
        Cookie: cookieHeader,
        Accept: 'text/event-stream',
      },
    },
  );

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export const dynamic = 'force-dynamic';
