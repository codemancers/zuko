import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import {
  ApolloSearchQueryDto,
  CreateIcpProfileDto,
  UpdateIcpProfileDto,
} from './dto/icp.dto';
import { IcpService } from './icp.service';

@ApiTags('ICP')
@ApiBearerAuth('session')
@Controller('icps')
@UseGuards(AuthGuard, OrganizationGuard)
export class IcpController {
  constructor(private readonly icpService: IcpService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new ICP profile' })
  @ApiResponse({ status: 201, description: 'ICP profile created' })
  async create(
    @OrgId() organizationId: number,
    @Body() dto: CreateIcpProfileDto,
  ) {
    return this.icpService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ICP profiles for the organization' })
  @ApiResponse({ status: 200, description: 'ICP profile list' })
  async list(@OrgId() organizationId: number) {
    return this.icpService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ICP profile' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'ICP profile' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.icpService.findById(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an ICP profile' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated ICP profile' })
  async update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIcpProfileDto,
  ) {
    return this.icpService.update(id, organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an ICP profile' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.icpService.delete(id, organizationId);
  }

  @Get(':id/companies')
  @ApiOperation({
    summary: 'Fetch matching companies from Apollo for this ICP',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Apollo companies result' })
  async getCompanies(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ApolloSearchQueryDto,
  ) {
    return this.icpService.getApolloCompanies(
      id,
      organizationId,
      query.page ?? 1,
      query.perPage ?? 25,
    );
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Fetch matching contacts from Apollo for this ICP' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Apollo contacts result' })
  async getContacts(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ApolloSearchQueryDto,
  ) {
    return this.icpService.getApolloContacts(
      id,
      organizationId,
      query.page ?? 1,
      query.perPage ?? 25,
    );
  }
}
