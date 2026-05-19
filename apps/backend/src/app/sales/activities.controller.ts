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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { ActivityService } from '@zuko/sales';
import type { RequestWithUser } from '@zuko/core';

// DTOs for API requests
export class CreateCommentDto {
  @ApiProperty({ example: 'Had a great call with the client today.' })
  content!: string;
}

export class UpdateCommentDto {
  @ApiProperty({ example: 'Updated comment content.' })
  content!: string;
}

export class ActivityQueryDto {
  @ApiPropertyOptional({ example: 'company' })
  entityType?: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  entityId?: number;

  @ApiPropertyOptional({ example: 'comment' })
  activityType?: string;

  @ApiPropertyOptional({ type: Number, example: 50 })
  limit?: number;

  @ApiPropertyOptional({ type: Number, example: 0 })
  offset?: number;
}

@ApiTags('Activities')
@ApiBearerAuth('session')
@Controller('activities')
@UseGuards(AuthGuard)
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'List activities with optional filters' })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: Number })
  @ApiQuery({ name: 'activityType', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Activity list' })
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
  @ApiOperation({ summary: 'Get an activity by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Activity details' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`[GET_ACTIVITY] Request for ID: ${id}`);
    return this.activityService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an activity' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Activity deleted' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[DELETE_ACTIVITY] Request for ID: ${id} by user: ${userId}`,
    );
    await this.activityService.delete(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an activity (e.g. edit comment)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated activity' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[UPDATE_ACTIVITY] Request for ID: ${id} by user: ${userId}`,
    );
    return this.activityService.update(id, userId, dto.content);
  }
}

// Nested routes for entity-specific activities
@ApiTags('Contact Activities')
@ApiBearerAuth('session')
@Controller('contacts/:contactId/activities')
@UseGuards(AuthGuard)
export class ContactActivitiesController {
  private readonly logger = new Logger(ContactActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get activity timeline for a contact' })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Activity timeline' })
  async getTimeline(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Query('limit') limitStr?: string,
  ) {
    this.logger.log(`[GET_CONTACT_TIMELINE] Contact ID: ${contactId}`);
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.activityService.getTimeline('contact', contactId, limit);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a contact' })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async createComment(
    @Req() req: RequestWithUser,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: CreateCommentDto,
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[CREATE_COMMENT] Contact ID: ${contactId}, User: ${userId}`,
    );

    try {
      const result = await this.activityService.createComment(
        'contact',
        contactId,
        userId,
        dto.content,
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

// Deal activities
@ApiTags('Deal Activities')
@ApiBearerAuth('session')
@Controller('deals/:dealId/activities')
@UseGuards(AuthGuard)
export class DealActivitiesController {
  private readonly logger = new Logger(DealActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get activity timeline for a deal' })
  @ApiParam({ name: 'dealId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Activity timeline' })
  async getTimeline(
    @Param('dealId', ParseIntPipe) dealId: number,
    @Query('limit') limitStr?: string,
  ) {
    this.logger.log(`[GET_DEAL_TIMELINE] Deal ID: ${dealId}`);
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.activityService.getTimeline('deal', dealId, limit);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a deal' })
  @ApiParam({ name: 'dealId', type: Number })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async createComment(
    @Req() req: RequestWithUser,
    @Param('dealId', ParseIntPipe) dealId: number,
    @Body() dto: CreateCommentDto,
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(`[CREATE_COMMENT] Deal ID: ${dealId}, User: ${userId}`);

    try {
      const result = await this.activityService.createComment(
        'deal',
        dealId,
        userId,
        dto.content,
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

// Task activities
@ApiTags('Task Activities')
@ApiBearerAuth('session')
@Controller('tasks/:taskId/activities')
@UseGuards(AuthGuard)
export class TaskActivitiesController {
  private readonly logger = new Logger(TaskActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get activity timeline for a task' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Activity timeline' })
  async getTimeline(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query('limit') limitStr?: string,
  ) {
    this.logger.log(`[GET_TASK_TIMELINE] Task ID: ${taskId}`);
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.activityService.getTimeline('task', taskId, limit);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiParam({ name: 'taskId', type: Number })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async createComment(
    @Req() req: RequestWithUser,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommentDto,
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(`[CREATE_COMMENT] Task ID: ${taskId}, User: ${userId}`);

    try {
      const result = await this.activityService.createComment(
        'task',
        taskId,
        userId,
        dto.content,
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
@ApiTags('Company Activities')
@ApiBearerAuth('session')
@Controller('companies/:companyId/activities')
@UseGuards(AuthGuard)
export class CompanyActivitiesController {
  private readonly logger = new Logger(CompanyActivitiesController.name);

  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Get activity timeline for a company' })
  @ApiParam({ name: 'companyId', type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Activity timeline' })
  async getTimeline(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('limit') limitStr?: string,
  ) {
    this.logger.log(`[GET_COMPANY_TIMELINE] Company ID: ${companyId}`);
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.activityService.getTimeline('company', companyId, limit);
  }

  @Post('comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a comment to a company' })
  @ApiParam({ name: 'companyId', type: Number })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async createComment(
    @Req() req: RequestWithUser,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateCommentDto,
  ) {
    const userId = parseInt(req.user.id, 10);
    this.logger.log(
      `[CREATE_COMMENT] Company ID: ${companyId}, User: ${userId}`,
    );

    try {
      const result = await this.activityService.createComment(
        'company',
        companyId,
        userId,
        dto.content,
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
