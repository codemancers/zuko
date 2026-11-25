import { ForbiddenError } from 'eve/channels/auth';

export const MCP_BODY_LIMIT = 1024 * 1024;

/** Bound the auth preflight too: Eve's transport limit runs after authentication. */
export async function readMcpRequest(request: Request) {
  if (Number(request.headers.get('content-length')) > MCP_BODY_LIMIT)
    throw new ForbiddenError({ code: 'request_too_large', message: 'MCP request exceeds 1 MiB' });
  const reader = request.clone().body?.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    if (reader)
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MCP_BODY_LIMIT) {
          void reader.cancel().catch(() => undefined);
          throw new ForbiddenError({
            code: 'request_too_large',
            message: 'MCP request exceeds 1 MiB',
          });
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
    const body: unknown = JSON.parse(chunks.join('') + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new ForbiddenError({
        code: 'invalid_request',
        message: 'Send one JSON-RPC request; batches are not supported',
      });
    return body as { method?: unknown; params?: { name?: unknown } };
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new ForbiddenError({ code: 'invalid_request', message: 'Invalid JSON-RPC request' });
    throw error;
  } finally {
    reader?.releaseLock();
  }
}
