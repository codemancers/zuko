import { Controller, Get, Req, Res } from '@nestjs/common';
import { AllowAnonymous, AuthService } from '@thallesp/nestjs-better-auth';
import { AUTH_BASE_PATH, MCP_PATH } from '../libs/better-auth/constants';
import { sendFetchResponse, toFetchRequest, type HttpRequest, type HttpResponse } from './http';

/**
 * Discovery documents that MCP clients fetch from the origin root, outside /api and
 * /auth. better-auth answers them itself when it sees the request; this only forwards.
 */
@Controller('.well-known')
export class WellKnownController {
  constructor(private readonly auth: AuthService) {}

  @Get(`oauth-authorization-server${AUTH_BASE_PATH}`)
  @AllowAnonymous()
  authorizationServer(@Req() req: HttpRequest, @Res() res: HttpResponse) {
    return this.forward(req, res);
  }

  @Get('oauth-protected-resource')
  @AllowAnonymous()
  protectedResource(@Req() req: HttpRequest, @Res() res: HttpResponse) {
    return this.forward(req, res);
  }

  @Get(`oauth-protected-resource${MCP_PATH}`)
  @AllowAnonymous()
  protectedMcpResource(@Req() req: HttpRequest, @Res() res: HttpResponse) {
    return this.forward(req, res);
  }

  private async forward(req: HttpRequest, res: HttpResponse) {
    await sendFetchResponse(res, await this.auth.instance.handler(toFetchRequest(req)));
  }
}
