import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ZodType } from 'zod';
import type * as z from 'zod';

// The slice of the HTTP request and response this filter uses. Express is the platform
// but not a direct dependency, so its types are not imported.
interface HttpResponse {
  status(code: number): { json(body: unknown): void };
}
interface HttpRequest {
  originalUrl: string;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
  /** On DUPLICATE_VALUE: the record that already holds the value, only when the caller may read it. */
  existing_id?: string;
}

/** An error the API reports with a stable machine-readable code. */
export class CrmError extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly errors: FieldError[] = [],
  ) {
    super({ code, message }, status);
  }
}

export const validationFailed = (errors: FieldError[]) =>
  new CrmError(400, 'VALIDATION_FAILED', errors[0]?.message ?? 'Validation failed', errors);
export const notFound = (message: string) => new CrmError(404, 'NOT_FOUND', message);
export const forbidden = (message: string) => new CrmError(403, 'FORBIDDEN', message);
export const conflict = (message: string) => new CrmError(409, 'CONFLICT', message);
export const badRequest = (code: string, message: string) => new CrmError(400, code, message);

/** Validate a request body or query with zod, reporting problems in the API's error format. */
export function parse<T extends ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw validationFailed(
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(body)',
      code: 'INVALID_FIELD',
      message: issue.message,
    })),
  );
}

/**
 * Renders every error as { code, message, errors, path, timestamp }, and maps
 * database constraint violations to 409 instead of leaking a 500.
 */
@Catch()
export class CrmExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CrmExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<HttpResponse>();
    const request = http.getRequest<HttpRequest>();

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let errors: FieldError[] = [];

    const prismaCode = (exception as { code?: unknown } | null)?.code;
    if (exception instanceof CrmError) {
      ({ status, code, message, errors } = { status: exception.getStatus(), code: exception.code, message: exception.message, errors: exception.errors });
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = `HTTP_${status}`;
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message);
    } else if (prismaCode === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'That value is already in use';
    } else if (prismaCode === 'P2003') {
      status = 409;
      code = 'CONFLICT';
      message = 'That change conflicts with related data';
    } else {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    response.status(status).json({ code, message, errors, path: request.originalUrl, timestamp: new Date().toISOString() });
  }
}
