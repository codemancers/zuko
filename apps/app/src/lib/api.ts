const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    /** What was wrong with which field, when the API says. */
    readonly errors: FieldError[] = [],
  ) {
    super(message);
  }
}

type Init = Omit<RequestInit, 'body'> & {
  /** A JSON request body. */
  json?: unknown;
};

/**
 * Call the backend's REST API (not better-auth's, which authClient covers) with the
 * session cookie. Errors carry the API's own message, code and field errors.
 */
export async function api<T>(path: string, { json, headers, ...init }: Init = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: json === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
      errors?: FieldError[];
    } | null;
    throw new ApiError(
      body?.message ?? `Request failed (${response.status})`,
      response.status,
      body?.code,
      body?.errors,
    );
  }
  return (await response.json()) as T;
}
