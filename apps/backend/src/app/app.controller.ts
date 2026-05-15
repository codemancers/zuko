import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { auth } from '../libs/better-auth/auth';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('.well-known/agent-configuration')
  async getAgentConfiguration() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (auth.api as any).getAgentConfiguration();
  }
}
