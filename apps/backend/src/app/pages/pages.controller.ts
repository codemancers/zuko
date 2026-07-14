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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import { UserId } from '../../common/auth/user-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PagesService } from './pages.service';
import {
  type CreatePageDto,
  CreatePageSchema,
  type UpdatePageDto,
  UpdatePageSchema,
} from './dto/page.dto';

@ApiTags('Pages')
@ApiBearerAuth('session')
@Controller('pages')
@UseGuards(AuthGuard, OrganizationGuard)
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'List wiki pages for the organization (flat)' })
  @ApiResponse({
    status: 200,
    description: 'Flat page list; tree via parentId',
  })
  async findAll(@OrgId() organizationId: number) {
    return this.pagesService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single page incl. content and subpages' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Page detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pagesService.findOne(id, organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a page (optionally nested via parentId)' })
  @ApiResponse({ status: 201, description: 'Page created' })
  async create(
    @OrgId() organizationId: number,
    @UserId() userId: number,
    @Body(new ZodPipe(CreatePageSchema)) dto: CreatePageDto,
  ) {
    return this.pagesService.create(dto, organizationId, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update title, content, or parent of a page' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated page detail' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodPipe(UpdatePageSchema)) dto: UpdatePageDto,
  ) {
    return this.pagesService.update(id, dto, organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a page (subtree removed via cascade)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async remove(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.pagesService.remove(id, organizationId);
  }
}
