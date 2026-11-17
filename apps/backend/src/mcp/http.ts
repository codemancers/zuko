import { BACKEND_URL } from '../libs/better-auth/constants';

// The slice of the HTTP request and response used to bridge to fetch-style handlers.
// Express is the platform but not a direct dependency, so its types are not imported.
export interface HttpRequest {
  method: string;
  originalUrl: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface HttpResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string | string[]): unknown;
  write(chunk: Uint8Array): unknown;
  end(): unknown;
  on(event: 'close', listener: () => void): unknown;
}

/** An Express-style request as a Fetch Request (the body travels separately, already parsed). */
export function toFetchRequest(req: HttpRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }
  return new Request(new URL(req.originalUrl, BACKEND_URL), { method: req.method, headers });
}

/** Write a Fetch Response to the HTTP response, streaming so event streams are not buffered. */
export async function sendFetchResponse(res: HttpResponse, response: Response): Promise<void> {
  res.status(response.status);
  const setCookies = response.headers.getSetCookie();
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') {
      res.setHeader(name, value);
    }
  });
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies);
  }
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  res.on('close', () => void reader.cancel().catch(() => undefined));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    res.write(value);
  }
  res.end();
}
