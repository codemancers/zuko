export interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
}

/** Who and what made the request, for the audit log. */
export function requestInfo(req: HttpRequest) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return {
    ip:
      first(req.headers['x-forwarded-for'])?.split(',')[0]?.trim() ||
      first(req.headers['x-real-ip']) ||
      null,
    userAgent: first(req.headers['user-agent']) ?? null,
    requestId: first(req.headers['x-request-id']) ?? null,
  };
}
