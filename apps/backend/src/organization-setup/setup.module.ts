import { Module } from '@nestjs/common';
import { WorkflowRuntimeModule } from '../workflow/workflow.module';
import { OrganizationSetupService } from './setup.service';

@Module({
  imports: [WorkflowRuntimeModule],
  providers: [OrganizationSetupService],
  exports: [OrganizationSetupService],
})
export class OrganizationSetupModule {}
