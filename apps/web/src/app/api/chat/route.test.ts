/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock Next.js cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    toString: () => 'mock-session-cookie=value',
  })),
}));

// Mock global fetch before importing route
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('/api/chat POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts chatId from referer header and forwards to backend', async () => {
    const mockRequestBody = {
      id: 'test-id',
      messages: [
        {
          parts: [{ type: 'text', text: 'Hello' }],
          id: 'msg-1',
          role: 'user',
        },
      ],
      trigger: 'submit-message',
    };

    const mockBackendResponse = new Response('mock streaming response', {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue(mockBackendResponse);

    // Create mock NextRequest with referer header
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:3000/chat/test-chat-123',
      },
      body: JSON.stringify(mockRequestBody),
    });

    const response = await POST(request);

    // Verify fetch was called with correct URL and body including chatId
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Cookie: 'mock-session-cookie=value',
          Accept: 'text/event-stream',
        }),
        body: JSON.stringify({
          ...mockRequestBody,
          chatId: 'test-chat-123',
        }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it('handles missing referer header gracefully', async () => {
    const mockRequestBody = {
      id: 'test-id',
      messages: [],
      trigger: 'submit-message',
    };

    const mockBackendResponse = new Response('mock response', {
      status: 200,
    });

    (global.fetch as jest.Mock).mockResolvedValue(mockBackendResponse);

    // Create request without referer header
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(mockRequestBody),
    });

    await POST(request);

    // Verify chatId is null when referer is missing
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const bodyArg = fetchCall[1].body;
    const parsedBody = JSON.parse(bodyArg);

    expect(parsedBody.chatId).toBeNull();
  });

  it('extracts chatId correctly from various URL formats', async () => {
    const testCases = [
      {
        referer: 'http://localhost:3000/chat/abc123',
        expectedChatId: 'abc123',
      },
      {
        referer: 'http://localhost:3000/chat/test-chat-with-dashes',
        expectedChatId: 'test-chat-with-dashes',
      },
      {
        referer: 'http://localhost:3000/chat/chat_123_test',
        expectedChatId: 'chat_123_test',
      },
      {
        referer: 'http://localhost:3000/chat/abc123?query=param',
        expectedChatId: 'abc123',
      },
      {
        referer: 'http://localhost:3000/chat/abc123#hash',
        expectedChatId: 'abc123',
      },
    ];

    for (const { referer, expectedChatId } of testCases) {
      jest.clearAllMocks();

      const mockBackendResponse = new Response('mock response', {
        status: 200,
      });

      (global.fetch as jest.Mock).mockResolvedValue(mockBackendResponse);

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          referer,
        },
        body: JSON.stringify({ messages: [] }),
      });

      await POST(request);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const bodyArg = fetchCall[1].body;
      const parsedBody = JSON.parse(bodyArg);

      expect(parsedBody.chatId).toBe(expectedChatId);
    }
  });

  it('forwards backend errors to the client', async () => {
    const mockRequestBody = {
      id: 'test-id',
      messages: [],
    };

    const mockBackendResponse = new Response('Backend error message', {
      status: 403,
    });

    (global.fetch as jest.Mock).mockResolvedValue(mockBackendResponse);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:3000/chat/test-123',
      },
      body: JSON.stringify(mockRequestBody),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).toBe('Backend error message');
  });

  it('handles backend fetch errors', async () => {
    const mockRequestBody = {
      id: 'test-id',
      messages: [],
    };

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:3000/chat/test-123',
      },
      body: JSON.stringify(mockRequestBody),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Network error');
  });

  it('includes correct headers when forwarding to backend', async () => {
    const mockBackendResponse = new Response('ok', { status: 200 });
    (global.fetch as jest.Mock).mockResolvedValue(mockBackendResponse);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:3000/chat/test-123',
      },
      body: JSON.stringify({ messages: [] }),
    });

    await POST(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Cookie: 'mock-session-cookie=value',
          Accept: 'text/event-stream',
        }),
        credentials: 'include',
      }),
    );
  });

  it('preserves streaming response from backend', async () => {
    const mockStreamBody = 'data: {"content":"test"}\n\n';
    const mockBackendResponse = new Response(mockStreamBody, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });

    (global.fetch as jest.Mock).mockResolvedValue(mockBackendResponse);

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: 'http://localhost:3000/chat/test-123',
      },
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request);

    // Verify response has SSE headers
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });
});
