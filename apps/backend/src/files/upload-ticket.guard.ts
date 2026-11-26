import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { RequestContext } from '../crm/context';
import { UploadTicketsService } from './upload-tickets.service';

/** Authorizes an upload by its link alone: spends the ticket and sets the request up as its owner. */
@Injectable()
export class UploadTicketGuard implements CanActivate {
  constructor(private readonly tickets: UploadTicketsService) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<{ params: { token?: string }; crm?: RequestContext }>();
    request.crm = await this.tickets.claim(String(request.params.token ?? ''));
    return true;
  }
}
