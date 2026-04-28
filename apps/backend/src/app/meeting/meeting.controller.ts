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
} from "@nestjs/common";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import type { RequestWithUser } from "@zuko/core";
import type { MeetingService } from "./meeting.service";
import { CallbackSchema, MeetingSchema, TranscriptChunkSchema } from "./dto/meeting.dto";
import type { CallbackDto, MeetingDto, TranscriptChunkDto } from "./dto/meeting.dto";
import { OrganizationGuard } from "../../common/auth/organization.guard";
import { AgentGuard } from "../../common/auth/agent.guard";
import { OrgId } from "../../common/auth/org-id.decorator";
import { ZodPipe } from "../../common/pipes/zod.pipe";

@Controller("meetings")
export class MeetingController {
  constructor(private readonly meetingService: MeetingService) {}

  @Post()
  @UseGuards(AuthGuard, OrganizationGuard)
  create(
    @Body(new ZodPipe(MeetingSchema)) meetingDto: MeetingDto,
    @OrgId() organizationId: number,
    @Req() req: RequestWithUser
  ) {
    const userId = parseInt(req.user.id, 10);
    return this.meetingService.create(meetingDto, organizationId, userId);
  }

  @Get()
  @UseGuards(AuthGuard, OrganizationGuard)
  findAll(@OrgId() organizationId: number) {
    return this.meetingService.findAll(organizationId);
  }

  @Post("webhook")
  @UsePipes(new ZodPipe(CallbackSchema))
  async webhook(@Body() callbackDto: CallbackDto) {
    return this.meetingService.webhook(callbackDto);
  }

  @Post(":meetingId/transcript-chunks")
  @UseGuards(AgentGuard)
  async addTranscriptChunk(
    @Param("meetingId") meetingId: string,
    @Body(new ZodPipe(TranscriptChunkSchema)) body: TranscriptChunkDto
  ) {
    await this.meetingService.addTranscriptChunk(
      meetingId,
      body.text || "",
      body.isFinal ?? false
    );
    return { ok: true };
  }

  @Get(":id/transcript")
  getTranscript(@Param("id") id: string) {
    return this.meetingService.getTranscript(id);
  }

  @Get(":id")
  @UseGuards(AuthGuard, OrganizationGuard)
  findOne(@Param("id") id: string, @OrgId() organizationId: number) {
    return this.meetingService.findOne(id, organizationId);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, OrganizationGuard)
  update(
    @Param("id") id: string,
    @OrgId() organizationId: number,
    @Body() meetingDto: MeetingDto
  ) {
    return this.meetingService.update(id, organizationId, meetingDto);
  }

  @Patch("action-items/:actionItemId")
  @UseGuards(AuthGuard, OrganizationGuard)
  async updateActionItem(
    @Param("actionItemId", ParseIntPipe) actionItemId: number,
    @OrgId() organizationId: number,
    @Body()
    body: {
      taskId: string;
      title: string;
      description?: string | null;
    }
  ) {
    return this.meetingService.updateActionItem(actionItemId, organizationId, {
      taskId: body.taskId,
      title: body.title,
      description: body.description ?? null,
    });
  }

  @Post(":id/end")
  @UseGuards(AuthGuard, OrganizationGuard)
  async endMeeting(@Param("id") id: string) {
    return this.meetingService.endMeeting(id);
  }

  @Delete(":id")
  @UseGuards(AuthGuard, OrganizationGuard)
  remove(@Param("id") id: string, @OrgId() organizationId: number) {
    return this.meetingService.remove(id, organizationId);
  }
}
