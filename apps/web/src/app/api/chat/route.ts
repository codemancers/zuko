/**
 * Chat API route - proxies to /api/v1/chat
 * This is the default endpoint expected by Vercel AI SDK's useChat hook
 */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();

    console.log('[/api/chat route.ts] Received body:', JSON.stringify(body, null, 2));

    // Extract chatId from the Referer header
    // Browser sends: http://localhost:3000/chat/{chatId}
    const referer = request.headers.get('referer') || '';
    const chatIdMatch = referer.match(/\/chat\/([^/?#]+)/);
    const chatId = chatIdMatch ? chatIdMatch[1] : null;

    console.log('[/api/chat route.ts] Extracted chatId from referer:', chatId);

    // Add chatId to the body
    const bodyWithChatId = {
      ...body,
      chatId,
    };

    console.log('[/api/chat route.ts] Body with chatId:', JSON.stringify(bodyWithChatId, null, 2));

    // Get cookies to forward session
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // Forward directly to backend (skip the /api/v1/chat internal hop)
    const backendUrl = `${BACKEND_URL}/api/v1/chat`;
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(bodyWithChatId),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(error, { status: response.status });
    }

    // Return the streaming response as-is
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[/api/chat] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
