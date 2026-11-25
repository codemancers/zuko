import { Controller, Get, Req, Res } from '@nestjs/common';
import { AllowAnonymous, AuthService } from '@thallesp/nestjs-better-auth';
import { AUTH_BASE_PATH, BACKEND_URL } from './constants';

interface MetadataResponse {
  status(code: number): void;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

/** OAuth issuer discovery stays with Better Auth; protected-resource discovery lives in the harness. */
@Controller('.well-known')
export class WellKnownController {
  constructor(private readonly auth: AuthService) {}

  @Get(`oauth-authorization-server${AUTH_BASE_PATH}`)
  @AllowAnonymous()
  async authorizationServer(@Req() req: { originalUrl: string }, @Res() res: MetadataResponse) {
    const response = await this.auth.instance.handler(
      new Request(new URL(req.originalUrl, BACKEND_URL)),
    );
    res.status(response.status);
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.json(await response.json());
  }
}
