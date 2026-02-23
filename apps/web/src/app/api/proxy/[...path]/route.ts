/**
 * Proxy API route - forwards all client requests to backend
 * This implements the BFF (Backend for Frontend) pattern
 *
 * Browser → Next.js /api/proxy → Backend API
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'POST');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'DELETE');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'PUT');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const path = pathSegments.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  // Don't add /api prefix here - the client already includes it in the path
  const url = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  // Get cookies from the request to forward session
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cookie': cookieHeader,
  };

  // Copy relevant headers from original request
  const relevantHeaders = ['authorization', 'accept', 'accept-language'];
  relevantHeaders.forEach((header) => {
    const value = request.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  });

  try {
    // Get request body for POST/PATCH/PUT/DELETE
    let body: string | undefined;
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      try {
        const json = await request.json();
        body = JSON.stringify(json);
      } catch {
        // No body or invalid JSON
        body = undefined;
      }
    }

    // Make request to backend
    const response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
    });

    // Handle 204 No Content responses
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // Get response data
    const data = await response.json().catch(() => null);

    // Return response with same status
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Proxy] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      url,
      method,
      path: pathSegments,
    });
    return NextResponse.json(
      {
        message: 'Proxy request failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
