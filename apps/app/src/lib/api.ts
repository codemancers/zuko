const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

/** Where MCP clients connect: the address a person pastes into Claude, Cursor and the like. */
export const MCP_URL = `${BACKEND_URL}/api/mcp`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * Call the backend's REST API (not better-auth's, which authClient covers) with the
 * session cookie. Errors carry the API's own message and code.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, { credentials: 'include', ...init });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status, body?.code);
  }
  return (await response.json()) as T;
}
