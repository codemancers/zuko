import { Controller, Get } from '@nestjs/common';
import { CurrentOrganization, RequireOrganization } from './organization-access';
import type { OrganizationContext } from './organization-access';

@Controller('organizations/:organizationId/access')
@RequireOrganization()
export class OrganizationAccessController {
  @Get()
  getAccess(@CurrentOrganization() organization: OrganizationContext) {
    // Only the verified context is exposed, never the session token or auth record.
    return organization;
  }
}
