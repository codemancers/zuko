import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

async function backendHeaders() {
  const cookieHeader = (await headers()).get('cookie') ?? '';
  const cookieStore = await cookies();
  const orgId = cookieStore.get('x-organization-id')?.value ?? '';
  return { cookie: cookieHeader, 'x-organization-id': orgId };
}

export async function GET() {
  try {
    const hdrs = await backendHeaders();
    const res = await fetch(`${BACKEND_URL}/api/eve-chats`, {
      headers: hdrs,
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list sessions' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const hdrs = await backendHeaders();
    const body = await request.json().catch(() => ({}));
    const res = await fetch(`${BACKEND_URL}/api/eve-chats`, {
      method: 'POST',
      headers: { ...hdrs, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save session' },
      { status: 500 },
    );
  }
}
