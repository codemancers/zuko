import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  try {
    const cookieHeader = (await headers()).get('cookie') ?? '';
    const cookieStore = await cookies();
    const orgId = cookieStore.get('x-organization-id')?.value ?? '';
    const res = await fetch(
      `${BACKEND_URL}/api/eve-chats/${encodeURIComponent(sessionId)}`,
      {
        headers: { cookie: cookieHeader, 'x-organization-id': orgId },
        cache: 'no-store',
      },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const s = error instanceof Error ? 500 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load session' },
      { status: s },
    );
  }
}
