import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { auth } from '../libs/better-auth/auth';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is running' })
  getData() {
    return this.appService.getData();
  }

  @Get('.well-known/agent-configuration')
  @ApiOperation({
    summary: 'Expose agent configuration for better-auth agent plugin',
  })
  @ApiResponse({ status: 200, description: 'Agent configuration JSON' })
  async getAgentConfiguration() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (auth.api as any).getAgentConfiguration();
  }
}
