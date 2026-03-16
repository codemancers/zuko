import { Controller, Get, Param } from "@nestjs/common";
import { OrgId } from "../../common/auth/org-id.decorator";

import {
  CompaniesService,
} from '@zuko/sales';


@Controller('agents')
export class AgentsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('companies/:id')
  async findCompanyById(@OrgId() organizationId: number, @Param('id') id: string) {
    return this.companiesService.findById(Number(id), organizationId);
  }
  
}