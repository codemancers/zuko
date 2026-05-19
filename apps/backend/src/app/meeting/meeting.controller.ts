import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  UsePipes,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { RequestWithUser } from '@zuko/core';
import { MeetingService } from './meeting.service';
import {
  CallbackSchema,
  MeetingSchema,
  TranscriptChunkSchema,
  MeetingApiDto,
  CallbackApiDto,
  TranscriptChunkApiDto,
  UpdateActionItemApiDto,
} from './dto/meeting.dto';
import type {
  CallbackDto,
  MeetingDto,
  TranscriptChunkDto,
} from './dto/meeting.dto';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { AgentGuard } from '../../common/auth/agent.guard';
import { OrgId } from '../../common/auth/org-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@ApiTags('Meetings')
@Controller('meetings')
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Create a new meeting' })
  @ApiBody({ type: MeetingApiDto })
  @ApiResponse({ status: 201, description: 'Meeting created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  create(
    @Body(new ZodPipe(MeetingSchema)) meetingDto: MeetingDto,
    @OrgId() organizationId: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = parseInt(req.user.id, 10);
    return this.meetingService.create(meetingDto, organizationId, userId);
  }

  @Get()
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'List meetings for the current organization' })
  @ApiResponse({ status: 200, description: 'Meeting list' })
  findAll(@OrgId() organizationId: number) {
    return this.meetingService.findAll(organizationId);
  }

  @Post('webhook')
  @UsePipes(new ZodPipe(CallbackSchema))
  @ApiOperation({
    summary: 'Receive meeting lifecycle callback from bot service (internal)',
  })
  @ApiBody({ type: CallbackApiDto })
  @ApiResponse({ status: 200, description: 'Callback processed' })
  async webhook(@Body() callbackDto: CallbackDto) {
    return this.meetingService.webhook(callbackDto);
  }

  @Post(':meetingId/transcript-chunks')
  @UseGuards(AgentGuard)
  @ApiBearerAuth('agent-jwt')
  @ApiOperation({ summary: 'Add a transcript chunk (agent-authenticated)' })
  @ApiParam({ name: 'meetingId', type: String })
  @ApiBody({ type: TranscriptChunkApiDto })
  @ApiResponse({ status: 200, description: 'Chunk added' })
  async addTranscriptChunk(
    @Param('meetingId') meetingId: string,
    @Body(new ZodPipe(TranscriptChunkSchema)) body: TranscriptChunkDto,
  ) {
    await this.meetingService.addTranscriptChunk(
      meetingId,
      body.text || '',
      body.isFinal ?? false,
    );
    return { ok: true };
  }

  @Get(':id/transcript')
  @ApiOperation({ summary: 'Get full transcript for a meeting' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Meeting transcript' })
  getTranscript(@Param('id') id: string) {
    return this.meetingService.getTranscript(id);
  }

  @Get(':id')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Get a meeting by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Meeting details' })
  findOne(@Param('id') id: string, @OrgId() organizationId: number) {
    return this.meetingService.findOne(id, organizationId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Update a meeting' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: MeetingApiDto })
  @ApiResponse({ status: 200, description: 'Updated meeting' })
  update(
    @Param('id') id: string,
    @OrgId() organizationId: number,
    @Body() meetingDto: MeetingDto,
  ) {
    return this.meetingService.update(id, organizationId, meetingDto);
  }

  @Patch('action-items/:actionItemId')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Update a meeting action item' })
  @ApiParam({ name: 'actionItemId', type: Number })
  @ApiBody({ type: UpdateActionItemApiDto })
  @ApiResponse({ status: 200, description: 'Action item updated' })
  async updateActionItem(
    @Param('actionItemId', ParseIntPipe) actionItemId: number,
    @OrgId() organizationId: number,
    @Body()
    body: {
      taskId: string;
      title: string;
      description?: string | null;
    },
  ) {
    return this.meetingService.updateActionItem(actionItemId, organizationId, {
      taskId: body.taskId,
      title: body.title,
      description: body.description ?? null,
    });
  }

  @Post(':id/end')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'End a meeting' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Meeting ended' })
  async endMeeting(@Param('id') id: string) {
    return this.meetingService.endMeeting(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, OrganizationGuard)
  @ApiBearerAuth('session')
  @ApiOperation({ summary: 'Delete a meeting' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Meeting deleted' })
  remove(@Param('id') id: string, @OrgId() organizationId: number) {
    return this.meetingService.remove(id, organizationId);
  }
}
