/**
 * Proxy API route - forwards all client requests to backend
 * This implements the BFF (Backend for Frontend) pattern
 *
 * Browser → Next.js /api/proxy → Backend API
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'POST');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'DELETE');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path, 'PUT');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  const path = pathSegments.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  // Don't add /api prefix here - the client already includes it in the path
  const url = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  // Forward the raw cookie header from the browser request to preserve session
  const cookieHeader = request.headers.get('cookie') || '';

  // Multipart bodies (file uploads, e.g. wiki page attachments) must be
  // streamed through untouched — JSON-parsing them destroys the payload,
  // and the boundary lives in the original Content-Type header.
  const incomingContentType = request.headers.get('content-type') || '';
  const isMultipart = incomingContentType.includes('multipart/form-data');

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': isMultipart ? incomingContentType : 'application/json',
    Cookie: cookieHeader,
  };

  // Copy relevant headers from original request (including org context for backend)
  const relevantHeaders = [
    'authorization',
    'accept',
    'accept-language',
    'x-organization-id',
  ];
  relevantHeaders.forEach((header) => {
    const value = request.headers.get(header);
    if (value) {
      headers[header] = value;
    }
  });

  try {
    // Get request body for POST/PATCH/PUT/DELETE
    let body: string | ArrayBuffer | undefined;
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      if (isMultipart) {
        // Pass the multipart payload through byte-for-byte.
        body = await request.arrayBuffer();
      } else {
        try {
          const json = await request.json();
          body = JSON.stringify(json);
        } catch {
          // No body or invalid JSON
          body = undefined;
        }
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

    // Non-JSON responses (attachment reads via /files/:id — images, SVGs,
    // downloads; fetch has already followed any 302 to storage) are streamed
    // back as-is instead of being coerced to JSON.
    const responseContentType = response.headers.get('content-type') || '';
    if (!responseContentType.includes('application/json')) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': responseContentType || 'application/octet-stream',
          ...(response.headers.get('content-disposition')
            ? {
                'Content-Disposition': response.headers.get(
                  'content-disposition',
                )!,
              }
            : {}),
        },
      });
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
      { status: 500 },
    );
  }
}
