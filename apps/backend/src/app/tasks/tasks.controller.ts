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
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskService } from '@zuko/sales';
import type { RequestWithUser } from '@zuko/core';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export class TaskListQueryDto {
  page?: number;
  limit?: number;
  parentId?: string; // numeric string or 'null'
}

@Controller('tasks')
@UseGuards(AuthGuard, OrganizationGuard)
export class TasksController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @OrgId() organizationId: number,
    @Body() dto: CreateTaskDto,
    @Req() req: RequestWithUser,
  ) {
    return this.taskService.createTask(organizationId, {
      ...dto,
      createdBy: req.user.name ?? req.user.email ?? undefined,
      createdByUserId: Number(req.user.id),
    });
  }

  @Get()
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

    return this.taskService.getTasks(organizationId, { page, limit, parentId });
  }

  @Get(':id')
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.taskService.getTaskById(organizationId, id);
  }

  @Patch(':id')
  async update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.taskService.deleteTask(organizationId, id);
  }
}
