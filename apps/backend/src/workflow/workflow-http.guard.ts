import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { isWorkflowRequest } from '@workflow/nest';

/**
 * Postgres jobs execute in process, so SDK HTTP routes are private.
 * This also blocks webhook callbacks and manifest/discovery routes; revisit the
 * blanket block before adding workflows that wait for external webhooks.
 */
@Injectable()
export class WorkflowHttpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (isWorkflowRequest(context)) throw new NotFoundException();
    return true;
  }
}
