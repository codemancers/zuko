import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { MeetingDto, CallbackDto } from "./dto/meeting.dto";
import axios from "axios";
import {
  getPlatformFromUrl,
  generateUtcCronExpression,
} from "../../utils/meeting";
import { PrismaService } from "../../prisma/prisma.service";
import { MeetingGateway } from "./meeting.gateway";
import { MeetingNotifyService } from "./meeting-notify.service";
import { MeetingTranscriptIngestService } from "./meeting-transcript-ingest.service";
import { MeetingStatus, MeetingPlatform } from "@prisma/client";

export interface TranscriptData {
  text: string;
  is_final: boolean;
  speech_final: boolean;
  confidence: number;
  timestamp: string;
  speaker: number;
  speaker_name?: string;
  duration_seconds: number;
  formatted_duration: string;
}

export interface ChatMessages {
  author?: string;
  text?: string;
  timeStamp?: string;
}

export interface ActionItems {
  taskId: string | null;
  title: string;
  description: string | null;
}

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meetingGateway: MeetingGateway,
    private readonly meetingTranscriptIngestService: MeetingTranscriptIngestService,
    private readonly meetingNotifyService: MeetingNotifyService
  ) {}

  async create(meetingDto: MeetingDto, organizationId: number, userId: number) {
    const platform = getPlatformFromUrl(meetingDto.url);

    const meeting = await this.prisma.meeting.create({
      data: {
        url: meetingDto.url,
        platform,
        name: meetingDto.name,
        description: meetingDto.description,
        scheduledAt: meetingDto.scheduledAt
          ? new Date(meetingDto.scheduledAt)
          : undefined,
        timezone: meetingDto.timezone,
        organizationId,
        createdBy: userId,
      },
    });

    const joinMeetingData = {
      meetingId: String(meeting.id),
      meetingUrl: meeting.url,
      callbackUrl: `${process.env.BACKEND_URL}/api/meetings/webhook`,
    };

    switch (meeting.platform) {
      case MeetingPlatform.GOOGLE_MEET: {
        const url = `${process.env.MEETING_BOT_BASE_URL}/api/google-meet/join`;

        if (meetingDto.scheduledAt && meetingDto.timezone) {
          const cronExpression = generateUtcCronExpression(
            meetingDto.scheduledAt,
            meetingDto.timezone
          );

          this.logger.log(
            `Scheduled meeting ${meeting.id} with cron: ${cronExpression}`
          );

          // Store cron expression in schedulerId for reference
          await this.prisma.meeting.update({
            where: { id: meeting.id },
            data: { schedulerId: cronExpression },
          });
        } else {
          await axios.post(url, joinMeetingData);
        }
        break;
      }
      default:
        throw new BadRequestException("Unsupported platform");
    }

    return {
      message: "Meeting created successfully",
      meeting,
    };
  }

  async findAll(organizationId: number) {
    return this.prisma.meeting.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, organizationId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(id) },
      include: {
        summaries: true,
        actionItems: true,
      },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");

    if (meeting.organizationId !== organizationId) {
      throw new ForbiddenException("You don't have access to this resource");
    }

    let transcript = null;
    let chatMessages = null;

    if (meeting.transcript) {
      try {
        const response = await axios.get(meeting.transcript);
        if (response.data?.transcripts) {
          transcript = response.data.transcripts;
          chatMessages = response.data.chatMessages || null;
        }
      } catch {
        this.logger.warn(`Failed to fetch transcript for meeting ${id}`);
      }
    }

    return {
      ...meeting,
      transcript,
      chatMessages,
    };
  }

  async update(id: string, organizationId: number, meetingDto: MeetingDto) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(id) },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");
    if (meeting.organizationId !== organizationId) {
      throw new ForbiddenException("You don't have access to this resource");
    }

    return this.prisma.meeting.update({
      where: { id: Number(id) },
      data: {
        name: meetingDto.name,
        description: meetingDto.description,
        scheduledAt: meetingDto.scheduledAt
          ? new Date(meetingDto.scheduledAt)
          : undefined,
        timezone: meetingDto.timezone,
      },
    });
  }

  async updateActionItem(
    actionItemId: number,
    organizationId: number,
    data: { taskId: string; title: string; description: string | null }
  ) {
    const actionItem = await this.prisma.meetingActionItem.findUnique({
      where: { id: actionItemId },
      include: { meeting: { select: { organizationId: true } } },
    });

    if (!actionItem) throw new BadRequestException("Action item not found");

    if (actionItem.meeting.organizationId !== organizationId) {
      throw new ForbiddenException("You don't have access to this resource");
    }

    const updated = await this.prisma.meetingActionItem.update({
      where: { id: actionItemId },
      data: {
        taskId: data.taskId,
        title: data.title,
        description: data.description,
      },
    });

    return { success: true, actionItem: updated };
  }

  async remove(id: string, organizationId: number) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(id) },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");

    if (meeting.organizationId !== organizationId) {
      throw new ForbiddenException("You don't have access to this resource");
    }

    await this.prisma.meeting.delete({ where: { id: Number(id) } });

    return { message: "Meeting deleted successfully" };
  }

  async webhook(callbackDto: CallbackDto) {
    const { meetingId, event, data } = callbackDto;
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(meetingId) },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");

    const statusMap: Record<string, MeetingStatus> = {
      in_progress: MeetingStatus.IN_PROGRESS,
      processing: MeetingStatus.PROCESSING,
      completed: MeetingStatus.COMPLETED,
      failed: MeetingStatus.FAILED,
      rejected: MeetingStatus.REJECTED,
    };

    const newStatus = statusMap[event] ?? meeting.status;

    await this.prisma.meeting.update({
      where: { id: Number(meetingId) },
      data: {
        status: newStatus,
        recording: data?.recording ?? meeting.recording,
        transcript: data?.transcript ?? meeting.transcript,
        flyMachineId: data?.flyMachineId ?? meeting.flyMachineId,
        schedulerId: null,
      },
    });

    if (event === "completed" && data?.transcript) {
      try {
        const response = await axios.get(data.transcript);
        const multiline = this.jsonTranscriptToMultiline(response.data);

        void this.storeMeetingSummaryFromTranscript(
          multiline,
          Number(meetingId),
          meeting.organizationId
        );
      } catch (err) {
        this.logger.error(
          `Failed to process transcript for meeting ${meetingId}`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return { message: "Meeting status updated successfully" };
  }

  async addTranscriptChunk(
    meetingId: string,
    text: string,
    isFinal = false
  ): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(meetingId) },
      select: { id: true, organizationId: true },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");

    if (!text?.trim()) {
      if (isFinal) {
        this.logger.log(
          `[Meeting ${meetingId}] Final transcript flush with no text`
        );
      }
      return;
    }

    try {
      await this.meetingTranscriptIngestService.ingestChunk({
        meetingId,
        organisationId: String(meeting.organizationId),
        text,
      });
      this.logger.log(
        `[Meeting ${meetingId}] Ingested transcript chunk (${text.length} chars)`
      );
    } catch (err) {
      this.logger.error(
        `[Meeting ${meetingId}] Ingest failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  async getTranscript(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(meetingId) },
      select: {
        id: true,
        name: true,
        description: true,
        url: true,
        platform: true,
        scheduledAt: true,
        status: true,
        transcript: true,
      },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");

    if (!meeting.transcript) {
      return {
        meetingId: meeting.id,
        name: meeting.name,
        description: meeting.description,
        url: meeting.url,
        platform: meeting.platform,
        scheduledAt: meeting.scheduledAt,
        status: meeting.status,
        transcript: null,
        message: "No transcript available for this meeting",
      };
    }

    try {
      const response = await axios.get(meeting.transcript);
      return {
        meetingId: meeting.id,
        name: meeting.name,
        description: meeting.description,
        url: meeting.url,
        platform: meeting.platform,
        scheduledAt: meeting.scheduledAt,
        status: meeting.status,
        transcript: response.data.transcripts || null,
        chatMessages: response.data.chatMessages || null,
      };
    } catch {
      throw new BadRequestException("Failed to fetch transcript");
    }
  }

  async endMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: Number(meetingId) },
    });

    if (!meeting) throw new BadRequestException("Meeting not found");

    await this.meetingNotifyService.notifyMeetingEnd(meetingId);

    return { message: "End command sent to bot", meetingId };
  }

  private jsonTranscriptToMultiline(payload: {
    transcripts?: TranscriptData[];
    chatMessages?: ChatMessages[];
  }): string {
    try {
      const lines = (payload.transcripts ?? []).map((t) => {
        const speaker = t?.speaker_name || "Speaker";
        const duration = t?.formatted_duration ? ` (${t.formatted_duration}s)` : "";
        return `${speaker}${duration}: ${t.text}`;
      });

      const chatLines = (payload.chatMessages ?? []).map((c) => {
        const author = c?.author || "Chat";
        return `CHAT - ${author}: ${c.text}`;
      });

      return [...lines, ...chatLines].join("\n");
    } catch {
      return "";
    }
  }

  private async storeMeetingSummaryFromTranscript(
    _transcript: string,
    meetingId: number,
    _organizationId: number
  ): Promise<void> {
    // Summarizer agent not configured; summary will be stored when agent is available.
    this.logger.log(
      `[Meeting ${meetingId}] Transcript ready; summarizer agent not yet configured`
    );
  }
}
