import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { ActivityService } from '@zuko/sales';

/** Request with authenticated user (set by AuthGuard) */
interface RequestWithUser {
  user: { id: string };
}

// DTOs for API requests
export class CreateCommentDto {
  content!: string;
}

export class UpdateCommentDto {
  content!: string;
}

export class ActivityQueryDto {
  entityType?: string;
  entityId?: number;
  activityType?: string;
  limit?: number;
  offset?: number;
}

@Controller('activities')
@UseGuards(AuthGuard)
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async list(@Query() query: ActivityQueryDto) {
    this.logger.log('[LIST_ACTIVITIES] Request received');

    const filters = {
      entityType: query.entityType,
      entityId: query.entityId ? Number(query.entityId) : undefined,
      activityType: query.activityType,
    };

    const pagination = {
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
    };

    return this.activityService.findAll(filters, pagination);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`[GET_ACTIVITY] Request for ID: ${id}`);
    return this.activityService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[DELETE_ACTIVITY] Request for ID: ${id} by user: ${userId}`
    );
    await this.activityService.delete(id, userId);
  }

  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[UPDATE_ACTIVITY] Request for ID: ${id} by user: ${userId}`
    );
    return this.activityService.update(id, userId, dto.content);
  }
}

// Nested routes for entity-specific activities
@Controller('contacts/:contactId/activities')
@UseGuards(AuthGuard)
export class ContactActivitiesController {
  private readonly logger = new Logger(ContactActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getTimeline(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Query('limit') limitStr?: string
  ) {
    this.logger.log(`[GET_CONTACT_TIMELINE] Contact ID: ${contactId}`);
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.activityService.getTimeline('contact', contactId, limit);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Req() req: RequestWithUser,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: CreateCommentDto
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[CREATE_COMMENT] Contact ID: ${contactId}, User: ${userId}`
    );

    try {
      const result = await this.activityService.createComment(
        'contact',
        contactId,
        userId,
        dto.content
      );
      this.logger.log(`[CREATE_COMMENT] Success - Activity ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[CREATE_COMMENT] Failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }
}

// Company activities (entityType 'company': contact | company | deal).
@Controller('companies/:companyId/activities')
@UseGuards(AuthGuard)
export class CompanyActivitiesController {
  private readonly logger = new Logger(CompanyActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  async getTimeline(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('limit') limitStr?: string
  ) {
    this.logger.log(`[GET_COMPANY_TIMELINE] Company ID: ${companyId}`);
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.activityService.getTimeline('company', companyId, limit);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Req() req: RequestWithUser,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateCommentDto
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[CREATE_COMMENT] Company ID: ${companyId}, User: ${userId}`
    );

    try {
      const result = await this.activityService.createComment(
        'company',
        companyId,
        userId,
        dto.content
      );
      this.logger.log(`[CREATE_COMMENT] Success - Activity ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[CREATE_COMMENT] Failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }
}
