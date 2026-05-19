import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskService } from '@zuko/sales';
import type { RequestWithUser } from '@zuko/core';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

export class TaskListQueryDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, example: 50 })
  limit?: number;

  @ApiPropertyOptional({
    type: String,
    description: 'Use "null" string for root-level tasks',
  })
  parentId?: string;

  @ApiPropertyOptional({ type: String, example: 'report' })
  search?: string;
}

@ApiTags('Tasks')
@ApiBearerAuth('session')
@Controller('tasks')
@UseGuards(AuthGuard, OrganizationGuard)
export class TasksController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async create(
    @OrgId() organizationId: number,
    @Body() dto: CreateTaskDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = Number(req.user.id);
    return this.taskService.createTask(
      organizationId,
      { ...dto, createdByUserId: actorId },
      actorId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List tasks with optional pagination and filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'parentId',
    required: false,
    type: String,
    description: 'Use "null" for root-level tasks',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated task list' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async list(
    @OrgId() organizationId: number,
    @Query() query: TaskListQueryDto,
  ) {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 50;
    const parentId =
      query.parentId !== undefined
        ? query.parentId === 'null'
          ? null
          : Number(query.parentId)
        : undefined;

    return this.taskService.getTasks(organizationId, {
      page,
      limit,
      parentId,
      search: query.search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.taskService.getTaskById(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated task' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @Req() req: RequestWithUser,
  ) {
    return this.taskService.updateTask(
      organizationId,
      id,
      dto,
      Number(req.user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.taskService.deleteTask(organizationId, id);
  }
}
