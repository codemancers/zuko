import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { RequestContext } from '../crm/context';
import { assertCanUploadFiles } from '../crm/permissions';

/**
 * Refuses an upload from a role that cannot create or change records or comment, before any bytes are
 * read. Runs after whatever set up the request's user (a session, a delegation, or an upload link).
 */
@Injectable()
export class UploadRoleGuard implements CanActivate {
  canActivate(execution: ExecutionContext): boolean {
    const request = execution.switchToHttp().getRequest<{ crm?: RequestContext }>();
    if (request.crm) assertCanUploadFiles(request.crm);
    return true;
  }
}
