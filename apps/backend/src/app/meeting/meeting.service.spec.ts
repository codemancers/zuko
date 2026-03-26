jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock("@langchain/langgraph-sdk", () => ({
  Client: jest.fn().mockImplementation(() => ({
    runs: {
      create: jest.fn(),
      get: jest.fn(),
      wait: jest.fn(),
      stream: jest.fn(),
    },
    threads: {
      create: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
      getState: jest.fn(),
      updateState: jest.fn(),
      getHistory: jest.fn(),
    },
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { MeetingService } from "./meeting.service";
import {
  DatabaseService,
  MeetingStatus,
  MeetingPlatform,
  MeetingPlatformSchemaName,
  MeetingStatusSchemaName,
} from "@gather/prisma";
import { PgBossService } from "@gather/shared";
import { ConfigService } from "@nestjs/config";
import { OrganisationService } from "@gather/core";
import { MeetingVideoJobService } from "../job-scheduler/meeting-video-job.service";
import { MeetingTranscriptIngestService } from "./meeting-transcript-ingest.service";
import { MeetingGateway } from "./meeting.gateway";
import { MeetingNotifyService } from "./meeting-notify.service";
import dayjs from "dayjs";
import nock from "nock";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

process.env.MEETING_BOT_BASE_URL = "https://meeting-bot.fly.dev";
process.env.GATHER_BE_URL = "https://gather-be.loca.lt";

describe("MeetingService", () => {
  let service: MeetingService;
  let databaseService: DatabaseService;
  let organisationService: Partial<OrganisationService>;
  let meetingVideoJobService: MeetingVideoJobService;
  let pgBossService: PgBossService;
  let user;
  let project;
  let meetingDto;
  let account;

  beforeEach(async () => {
    // Create mock OrganisationService
    organisationService = {
      create: jest.fn(),
      findAllOrganisations: jest.fn(),
      findOrganisationById: jest.fn(),
      updateOrganisation: jest.fn(),
      removeOrganisation: jest.fn(),
      getWorkspaceIdFromOrganisationConnections: jest.fn(),
      getBotTokenFromOrganisationConnections: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingService,
        DatabaseService,
        {
          provide: PgBossService,
          useValue: {
            scheduleCronJob: jest.fn().mockResolvedValue(undefined),
            boss: {
              unschedule: jest.fn().mockResolvedValue(undefined),
            },
          },
        },
        {
          provide: OrganisationService,
          useValue: organisationService,
        },
        {
          provide: MeetingVideoJobService,
          useValue: {
            scheduleTranscodeJob: jest.fn(),
          },
        },
        {
          provide: MeetingTranscriptIngestService,
          useValue: {
            ingestChunk: jest.fn(),
          },
        },
        {
          provide: MeetingGateway,
          useValue: {
            sendEnd: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: MeetingNotifyService,
          useValue: {
            notifyMeetingEnd: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MeetingService>(MeetingService);
    databaseService = module.get(DatabaseService);
    pgBossService = module.get(PgBossService);
    meetingVideoJobService = module.get(MeetingVideoJobService);

    const uniqueId = Date.now().toString();
    const bot = await databaseService.client.bot.create({
      data: {
        botId: `bot-${uniqueId}`,
        userId: `user-${uniqueId}`,
        botToken: `bot-token-${uniqueId}`,
        teamId: `slack-workspace-${uniqueId}`,
      },
    });

    user = await databaseService.client.user.create({
      data: {
        name: "Test User",
        email: `test-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}@example.com`,
        image: "https://example.com/avatar.jpg",
      },
    });

    // Create organization first
    const organisation = await databaseService.client.organisation.create({
      data: {
        name: `Test Organisation ${uniqueId}`,
      },
    });

    // Add currentOrganisation to user object for tests
    user.currentOrganisation = { id: organisation.id };

    account = await databaseService.client.account.create({
      data: {
        user: {
          connect: {
            id: user.id,
          },
        },
        type: "oauth",
        ok: true,
        provider: "slack",
        providerAccountId: "slack-user-123",
        bot: {
          connect: {
            teamId: bot.teamId,
          },
        },
      },
    });

    project = await databaseService.client.project.create({
      data: {
        name: "Test Project",
        description: "Test Description",
        organisationId: organisation.id,
      },
    });

    meetingDto = {
      url: "https://meet.google.com/abc-defg-hij",
      name: "Test Meeting",
      description: "Test Description",
      scheduledAt: "2024-01-15T10:00:00Z",
      timezone: "UTC",
      projectId: project.id,
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Clean up in proper order to avoid foreign key constraint violations
    await databaseService.client.meeting.deleteMany();
    await databaseService.client.project.deleteMany();
    await databaseService.client.account.deleteMany();
    await databaseService.client.user.deleteMany();
    await databaseService.client.organisation.deleteMany();
    await databaseService.client.bot.deleteMany();
    await databaseService.client.meetingSummary.deleteMany();
    await databaseService.client.meetingActionItem.deleteMany();
  });

  describe("create", () => {
    it("creates a meeting successfully with scheduled time", async () => {
      const result = await service.create(meetingDto, user);

      expect(result.message).toEqual("Meeting created successfully");
      expect(result.meeting.url).toEqual(meetingDto.url);
      expect(result.meeting.name).toEqual(meetingDto.name);
      expect(result.meeting.description).toEqual(meetingDto.description);
      expect(result.meeting.timezone).toEqual(meetingDto.timezone);
      expect(
        dayjs(result.meeting.scheduledAt).format("YYYY-MM-DD HH:mm:ss")
      ).toEqual(dayjs(meetingDto.scheduledAt).format("YYYY-MM-DD HH:mm:ss"));

      const meeting = await databaseService.client.meeting.findUnique({
        where: { id: result.meeting.id },
      });

      expect(meeting.schedulerId).toEqual(`schedule-${result.meeting.id}`);

      expect(pgBossService.scheduleCronJob).toHaveBeenCalledWith(
        "meeting-bot-schedule",
        expect.any(String),
        expect.objectContaining({ meetingId: result.meeting.id }),
        {
          key: `schedule-${result.meeting.id}`,
          tz: "UTC",
        }
      );
    });

    it("creates a meeting successfully without scheduled time", async () => {
      nock(process.env.MEETING_BOT_BASE_URL)
        .post("/api/google-meet/join")
        .reply(201);

      const meetingDtoWithoutSchedule = {
        ...meetingDto,
        scheduledAt: undefined,
      };

      const result = await service.create(meetingDtoWithoutSchedule, user);

      expect(result.message).toEqual("Meeting created successfully");
      expect(result.meeting.url).toEqual(meetingDtoWithoutSchedule.url);
      expect(result.meeting.name).toEqual(meetingDtoWithoutSchedule.name);
      expect(result.meeting.description).toEqual(
        meetingDtoWithoutSchedule.description
      );
      expect(result.meeting.timezone).toEqual(
        meetingDtoWithoutSchedule.timezone
      );
      expect(result.meeting.scheduledAt).toBe(null);
    });

    it("throws BadRequestException for unsupported platform", async () => {
      const unsupportedMeetingDto = {
        ...meetingDto,
        url: "https://unsupported-platform.com/meeting",
      };

      await expect(service.create(unsupportedMeetingDto, user)).rejects.toThrow(
        BadRequestException
      );
    });

    it("throws error when user has no organization context", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: null,
      };

      await expect(
        service.create(meetingDto, userWithOrgGuard)
      ).rejects.toThrow("User organisation context not found");
    });

    it("throws UnauthorizedException when project does not belong to user's organization", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: 999 }, // Different org ID
      };

      // Mock project with different organization ID
      jest
        .spyOn(databaseService.client.project, "findUnique")
        .mockResolvedValue({
          id: project.id,
          organisationId: 888, // Different from user's org
        } as any);

      await expect(
        service.create(meetingDto, userWithOrgGuard)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.create(meetingDto, userWithOrgGuard)
      ).rejects.toThrow("Project does not belong to your organization");
    });

    it("creates meeting successfully when project belongs to user's organization", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: user.currentOrganisation.id },
      };

      // Mock project with same organization ID
      jest
        .spyOn(databaseService.client.project, "findUnique")
        .mockResolvedValue({
          id: project.id,
          organisationId: user.currentOrganisation.id, // Same as user's org
        } as any);

      const result = await service.create(meetingDto, userWithOrgGuard);

      expect(result.message).toEqual("Meeting created successfully");
      expect(result.meeting.url).toEqual(meetingDto.url);
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      // Clean up any existing meetings and project-meetings first
      await databaseService.client.projectMeeting.deleteMany();
      await databaseService.client.meeting.deleteMany();

      // Create a non-deleted meeting that matches the expected data
      const meeting = await databaseService.client.meeting.create({
        data: {
          url: meetingDto.url,
          name: meetingDto.name,
          description: meetingDto.description,
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          createdBy: user.id,
        },
      });

      await databaseService.client.projectMeeting.create({
        data: {
          projectId: project.id,
          meetingId: meeting.id,
        },
      });

      // Create a soft-deleted meeting
      const softDeletedMeeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/abc-defg-jhi",
          name: "Test Meeting 2",
          description: "Test Description 2",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          createdBy: user.id,
          deletedAt: new Date(),
        },
      });

      await databaseService.client.projectMeeting.create({
        data: {
          projectId: project.id,
          meetingId: softDeletedMeeting.id,
        },
      });
    });

    it("returns only non-soft-deleted meetings for a user's workspace", async () => {
      user.account = account;

      const result = await service.findAll(user);

      expect(result.length).toEqual(1);
      expect(result[0].url).toEqual(meetingDto.url);
      expect(result[0].name).toEqual(meetingDto.name);
      expect(result[0].description).toEqual(meetingDto.description);
    });

    it("throws error when user has no organization context", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: null,
      };

      await expect(service.findAll(userWithOrgGuard)).rejects.toThrow(
        "User organisation context not found"
      );
    });

    it("returns meetings successfully", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: user.currentOrganisation.id },
      };

      // Mock projectMeeting.findMany to return meeting links
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([{ meetingId: 1 }] as any);

      // Mock meeting.findMany to return meetings
      jest.spyOn(databaseService.client.meeting, "findMany").mockResolvedValue([
        {
          id: 1,
          url: meetingDto.url,
          name: meetingDto.name,
          description: meetingDto.description,
        },
      ] as any);

      const result = await service.findAll(userWithOrgGuard);

      expect(result.length).toEqual(1);
      expect(result[0].url).toEqual(meetingDto.url);
      expect(result[0].name).toEqual(meetingDto.name);
      expect(result[0].description).toEqual(meetingDto.description);
    });
  });

  describe("findOne", () => {
    let meeting;
    let meetingSummary;
    let meetingActionItem;

    beforeEach(async () => {
      // Clean up any existing meetings and project-meetings first
      await databaseService.client.projectMeeting.deleteMany();
      await databaseService.client.meeting.deleteMany();
      await databaseService.client.project.deleteMany();
      await databaseService.client.meetingSummary.deleteMany();
      await databaseService.client.meetingActionItem.deleteMany();

      // Create a project under the user's organisation
      project = await databaseService.client.project.create({
        data: {
          name: "Test Project",
          description: "Test project description",
          organisation: {
            connect: { id: user.currentOrganisation.id },
          },
        },
      });

      // Create a meeting connecting to above project
      meeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/abc-defg-hij",
          name: "Test Meeting",
          description: "Test Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          transcript: "meetings/1/transcripts.json",
          recording: "meetings/1/recordings.mp4",
          createdBy: user.id,
          projects: {
            create: {
              projectId: project.id,
            },
          },
        },
        include: {
          projects: { include: { project: true } },
        },
      });

      meetingSummary = await databaseService.client.meetingSummary.create({
        data: {
          content: "Summary",
          meeting: { connect: { id: meeting.id } },
        },
      });

      meetingActionItem = await databaseService.client.meetingActionItem.create(
        {
          data: {
            meeting: { connect: { id: meeting.id } },
            title: "Test",
            description: "Test",
          },
        }
      );
    });

    it("returns meeting with presigned URLs when recording and transcript exist", async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue(
        "https://presigned-url.com"
      );

      nock("https://presigned-url.com")
        .get("/")
        .reply(200, {
          transcripts: [
            { speaker_name: "John Doe", text: "Hello, how are you?" },
          ],
          chatMessages: [
            {
              user: {
                fullName: "Sarah Chen",
                profilePicture:
                  "https://lh3.googleusercontent.com/mm/ALrkI7pvr6UKbHAAsM4_YuzZqm5XU3o_FCQkfi04knIcTL8xUliCeVgsM7F4K5oeMY644Tiy-g",
              },
              text: "Thanks for sharing the agenda! Looking forward to discussing the Q4 roadmap.",
            },
          ],
        });

      const result = await service.findOne(meeting.id.toString(), user);

      expect(result.recordingUrl).toEqual("https://presigned-url.com");
      expect(result.transcript).toEqual([
        { speaker_name: "John Doe", text: "Hello, how are you?" },
      ]);
      expect(result.chatMessages).toEqual([
        {
          user: {
            fullName: "Sarah Chen",
            profilePicture:
              "https://lh3.googleusercontent.com/mm/ALrkI7pvr6UKbHAAsM4_YuzZqm5XU3o_FCQkfi04knIcTL8xUliCeVgsM7F4K5oeMY644Tiy-g",
          },
          text: "Thanks for sharing the agenda! Looking forward to discussing the Q4 roadmap.",
        },
      ]);
    });

    it("returns meeting without presigned URLs when no recording or transcript", async () => {
      const meeting2 = await databaseService.client.meeting.update({
        where: { id: meeting.id },
        data: {
          transcript: null,
          recording: null,
        },
        include: {
          projects: { include: { project: true } },
        },
      });

      // Mock project with same organization ID as user
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: user.currentOrganisation.id, // Match user's org
            },
          },
        ] as any);

      const result = await service.findOne(meeting2.id.toString(), user);

      expect(result.recordingUrl).toEqual(null);
      expect(result.transcript).toEqual(null);
      expect(result.url).toEqual(meeting2.url);
      expect(result.name).toEqual(meeting2.name);
      expect(result.description).toEqual(meeting2.description);
    });

    it("throws BadRequestException when meeting not found", async () => {
      await expect(service.findOne("0", user)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.findOne("0", user)).rejects.toThrow(
        "Meeting not found"
      );
    });

    it("throws error when user has no organization context", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: null,
      };

      await expect(
        service.findOne(meeting.id.toString(), userWithOrgGuard)
      ).rejects.toThrow("User organisation context not found");
    });

    it("throws ForbiddenException when meeting does not belong to user's organisation", async () => {
      // Create a different organisation for the project
      const differentOrg = await databaseService.client.organisation.create({
        data: { name: "Different Org" },
      });

      // Update the project to belong to this different organisation
      await databaseService.client.project.update({
        where: { id: project.id },
        data: { organisationId: differentOrg.id },
      });

      // User's current organisation is different from the meeting's organisation
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: 999 }, // some ID that does not match differentOrg.id
      };

      await expect(
        service.findOne(meeting.id.toString(), userWithOrgGuard)
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.findOne(meeting.id.toString(), userWithOrgGuard)
      ).rejects.toThrow("You don't have access to this resource");
    });

    it("returns meeting successfully when meeting belongs to user's organization", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: user.currentOrganisation.id },
      };

      // Mock project with same organization ID
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: user.currentOrganisation.id, // Same as user's org
            },
          },
        ] as any);

      (getSignedUrl as jest.Mock).mockResolvedValue(
        "https://presigned-url.com"
      );

      nock("https://presigned-url.com")
        .get("/")
        .reply(200, {
          transcripts: [
            {
              speaker_name: "John Doe",
              text: "Hello, how are you?",
            },
          ],
          chatMessages: [
            {
              user: {
                fullName: "Sarah Chen",
                profilePicture:
                  "https://lh3.googleusercontent.com/mm/ALrkI7pvr6UKbHAAsM4_YuzZqm5XU3o_FCQkfi04knIcTL8xUliCeVgsM7F4K5oeMY644Tiy-g",
              },
              text: "Thanks for sharing the agenda! Looking forward to discussing the Q4 roadmap.",
            },
          ],
        });

      const result = await service.findOne(
        meeting.id.toString(),
        userWithOrgGuard
      );

      expect(result.recordingUrl).toEqual("https://presigned-url.com");
      expect(result.transcript).toEqual([
        {
          speaker_name: "John Doe",
          text: "Hello, how are you?",
        },
      ]);

      expect(result.chatMessages).toEqual([
        {
          user: {
            fullName: "Sarah Chen",
            profilePicture:
              "https://lh3.googleusercontent.com/mm/ALrkI7pvr6UKbHAAsM4_YuzZqm5XU3o_FCQkfi04knIcTL8xUliCeVgsM7F4K5oeMY644Tiy-g",
          },
          text: "Thanks for sharing the agenda! Looking forward to discussing the Q4 roadmap.",
        },
      ]);
    });

    it("returns meeting summary and action items", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: user.currentOrganisation.id },
      };

      // Mock project with same organization ID
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: user.currentOrganisation.id, // Same as user's org
            },
          },
        ] as any);

      (getSignedUrl as jest.Mock).mockResolvedValue(
        "https://presigned-url.com"
      );

      nock("https://presigned-url.com")
        .get("/")
        .reply(200, {
          transcripts: [
            {
              speaker_name: "John Doe",
              text: "Hello, how are you?",
            },
          ],
          chatMessages: [
            {
              user: {
                fullName: "Sarah Chen",
                profilePicture:
                  "https://lh3.googleusercontent.com/mm/ALrkI7pvr6UKbHAAsM4_YuzZqm5XU3o_FCQkfi04knIcTL8xUliCeVgsM7F4K5oeMY644Tiy-g",
              },
              text: "Thanks for sharing the agenda! Looking forward to discussing the Q4 roadmap.",
            },
          ],
        });

      const result = await service.findOne(
        meeting.id.toString(),
        userWithOrgGuard
      );

      expect(result.recordingUrl).toEqual("https://presigned-url.com");
      expect(result.transcript).toEqual([
        {
          speaker_name: "John Doe",
          text: "Hello, how are you?",
        },
      ]);
      expect(result.chatMessages).toEqual([
        {
          user: {
            fullName: "Sarah Chen",
            profilePicture:
              "https://lh3.googleusercontent.com/mm/ALrkI7pvr6UKbHAAsM4_YuzZqm5XU3o_FCQkfi04knIcTL8xUliCeVgsM7F4K5oeMY644Tiy-g",
          },
          text: "Thanks for sharing the agenda! Looking forward to discussing the Q4 roadmap.",
        },
      ]);
      expect(result.actionItems).toEqual([meetingActionItem]);
      expect(result.summary).toEqual(meetingSummary);
    });
  });

  describe("webhook", () => {
    let meeting;
    let callbackDto;

    beforeEach(async () => {
      // Clean up any existing meetings and project-meetings first
      await databaseService.client.projectMeeting.deleteMany();
      await databaseService.client.meeting.deleteMany();

      meeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/abc-defg-hij",
          name: "Test Meeting",
          description: "Test Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          status: MeetingStatusSchemaName.PENDING,
          createdBy: user.id,
        },
      });

      await databaseService.client.projectMeeting.create({
        data: {
          projectId: project.id,
          meetingId: meeting.id,
        },
      });

      callbackDto = {
        meetingId: meeting.id,
        event: "in_progress",
        data: {
          recording: "recording-key",
          transcript: "transcript-key",
        },
      };
    });

    it("handles event", async () => {
      const result = await service.webhook(callbackDto);

      expect(result).toEqual({
        message: "Meeting status updated successfully",
      });

      const updatedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meeting.id },
      });

      expect(updatedMeeting.status).toEqual(
        MeetingStatusSchemaName.IN_PROGRESS
      );
    });

    it("maps rejected event to rejected meeting status", async () => {
      const result = await service.webhook({
        ...callbackDto,
        event: "rejected",
      });

      expect(result).toEqual({
        message: "Meeting status updated successfully",
      });

      const updatedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meeting.id },
      });

      expect(updatedMeeting.status).toEqual(MeetingStatusSchemaName.REJECTED);
    });

    it("updates the recording and transcript when they are present", async () => {
      const result = await service.webhook({
        ...callbackDto,
        transcript: "transcript-key",
        recording: "recording-key",
      });

      expect(result).toEqual({
        message: "Meeting status updated successfully",
      });

      const updatedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meeting.id },
      });

      expect(updatedMeeting.transcript).toEqual("transcript-key");
      expect(updatedMeeting.recording).toEqual("recording-key");
    });

    it("schedules a video transcode job when completed event has a .webm recording", async () => {
      const spy = jest.spyOn(meetingVideoJobService, "scheduleTranscodeJob");

      const webmCallback = {
        meetingId: meeting.id,
        event: "completed",
        data: {
          recording: "meetings/123/recording.webm",
          transcript: "transcript-key",
        },
      };

      const result = await service.webhook(webmCallback as any);

      expect(result).toEqual({
        message: "Meeting status updated successfully",
      });
      expect(spy).toHaveBeenCalledWith(
        Number(meeting.id),
        "meetings/123/recording.webm"
      );
    });

    it("updates the meeting with fly machine id when fly machine is launched", async () => {
      nock(process.env.MEETING_BOT_BASE_URL)
        .post("/api/google-meet/join")
        .reply(201, {
          flyMachineId: "fly-machine-123",
        });
      const result = await service.webhook({
        ...callbackDto,
        event: "fly-machine-launched",
        data: {
          flyMachineId: "fly-machine-123",
        },
      });

      expect(result).toEqual({
        message: "Meeting status updated successfully",
      });

      const updatedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meeting.id },
      });
      expect(updatedMeeting.flyMachineId).toEqual("fly-machine-123");
    });
  });

  describe("remove", () => {
    let meeting;
    let meetingWithScheduler;

    beforeEach(async () => {
      // Clean up any existing meetings and project-meetings first
      await databaseService.client.projectMeeting.deleteMany();
      await databaseService.client.meeting.deleteMany();

      meeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/abc-defg-hij",
          name: "Test Meeting",
          description: "Test Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          createdBy: user.id,
        },
      });

      await databaseService.client.projectMeeting.create({
        data: {
          projectId: project.id,
          meetingId: meeting.id,
        },
      });

      meetingWithScheduler = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/xyz-uvw-rst",
          name: "Scheduled Meeting",
          description: "Scheduled Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          schedulerId: "schedule-456",
          createdBy: user.id,
        },
      });

      await databaseService.client.projectMeeting.create({
        data: {
          projectId: project.id,
          meetingId: meetingWithScheduler.id,
        },
      });
    });

    it("removes a meeting successfully", async () => {
      // Mock project with same organization ID as user
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: user.currentOrganisation.id, // Match user's org
            },
          },
        ] as any);

      const result = await service.remove(meeting.id.toString(), user);

      expect(result).toEqual({
        message: "Meeting deleted successfully",
      });

      const deletedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meeting.id },
      });

      expect(deletedMeeting).toBeNull();
    });

    it("removes a meeting with scheduler and deletes the scheduler", async () => {
      // Mock project with same organization ID as user
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: user.currentOrganisation.id, // Match user's org
            },
          },
        ] as any);


      const result = await service.remove(
        meetingWithScheduler.id.toString(),
        user
      );

      expect(result).toEqual({
        message: "Meeting deleted successfully",
      });

      const deletedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meetingWithScheduler.id },
      });
      expect(deletedMeeting).toBeNull();

      expect(pgBossService.boss.unschedule).toHaveBeenCalledWith(
        "meeting-bot-schedule",
        "schedule-456"
      );
    });

    it("throws BadRequestException when meeting not found", async () => {
      await expect(service.remove("0", user)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.remove("0", user)).rejects.toThrow(
        "Meeting not found"
      );
    });

    it("throws error when user has no organization context", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: null,
      };

      await expect(
        service.remove(meeting.id.toString(), userWithOrgGuard)
      ).rejects.toThrow("User organisation context not found");
    });

    it("throws UnauthorizedException when meeting does not belong to user's organisation", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: 999 }, // Different org ID
      };

      // Mock project with different organization ID
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: 888, // Different from user's org
            },
          },
        ] as any);

      await expect(
        service.remove(meeting.id.toString(), userWithOrgGuard)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.remove(meeting.id.toString(), userWithOrgGuard)
      ).rejects.toThrow("Meeting not found in user's organisation");
    });

    it("removes meeting successfully when meeting belongs to user's organization", async () => {
      const userWithOrgGuard = {
        ...user,
        currentOrganisation: { id: user.currentOrganisation.id },
      };

      // Mock project with same organization ID
      jest
        .spyOn(databaseService.client.projectMeeting, "findMany")
        .mockResolvedValue([
          {
            project: {
              organisationId: user.currentOrganisation.id, // Same as user's org
            },
          },
        ] as any);

      const result = await service.remove(
        meeting.id.toString(),
        userWithOrgGuard
      );

      expect(result).toEqual({
        message: "Meeting deleted successfully",
      });

      const deletedMeeting = await databaseService.client.meeting.findUnique({
        where: { id: meeting.id },
      });

      expect(deletedMeeting).toBeNull();
    });
  });

  describe("updateActionItem", () => {
    let meeting;
    let actionItem;
    let differentOrgMeeting;
    let differentOrgActionItem;

    beforeEach(async () => {
      // Clean up any existing data
      await databaseService.client.meetingActionItem.deleteMany();
      await databaseService.client.meetingSummary.deleteMany();
      await databaseService.client.projectMeeting.deleteMany();
      await databaseService.client.meeting.deleteMany();
      await databaseService.client.project.deleteMany();

      // Create a project under the user's organisation
      project = await databaseService.client.project.create({
        data: {
          name: "Test Project",
          description: "Test project description",
          organisation: {
            connect: { id: user.currentOrganisation.id },
          },
        },
      });

      // Create a meeting connecting to above project
      meeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/abc-defg-hij",
          name: "Test Meeting",
          description: "Test Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          createdBy: user.id,
          projects: {
            create: {
              projectId: project.id,
            },
          },
        },
      });

      // Create an action item for the meeting
      actionItem = await databaseService.client.meetingActionItem.create({
        data: {
          meeting: { connect: { id: meeting.id } },
          title: "Original Title",
          description: "Original Description",
        },
      });

      // Create a different organisation and meeting for forbidden tests
      const differentOrg = await databaseService.client.organisation.create({
        data: { name: "Different Organisation" },
      });

      const differentOrgProject = await databaseService.client.project.create({
        data: {
          name: "Different Project",
          description: "Different project description",
          organisation: {
            connect: { id: differentOrg.id },
          },
        },
      });

      differentOrgMeeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/xyz-uvw-rst",
          name: "Different Meeting",
          description: "Different Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          createdBy: user.id,
          projects: {
            create: {
              projectId: differentOrgProject.id,
            },
          },
        },
      });

      differentOrgActionItem =
        await databaseService.client.meetingActionItem.create({
          data: {
            meeting: { connect: { id: differentOrgMeeting.id } },
            title: "Different Title",
            description: "Different Description",
          },
        });
    });

    it("should successfully update action item with all fields", async () => {
      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: "Updated Description",
      };

      const result = await service.updateActionItem(
        actionItem.id,
        user,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.actionItem.id).toBe(actionItem.id);
      expect(result.actionItem.title).toBe(updateData.title);
      expect(result.actionItem.description).toBe(updateData.description);
      expect(result.actionItem.taskId).toBe(updateData.taskId);

      // Verify in database
      const updatedItem =
        await databaseService.client.meetingActionItem.findUnique({
          where: { id: actionItem.id },
        });

      expect(updatedItem.title).toBe(updateData.title);
      expect(updatedItem.description).toBe(updateData.description);
      expect(updatedItem.taskId).toBe(updateData.taskId);
    });

    it("should successfully update action item with null description", async () => {
      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: null,
      };

      const result = await service.updateActionItem(
        actionItem.id,
        user,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.actionItem.description).toBeNull();
      expect(result.actionItem.title).toBe(updateData.title);
      expect(result.actionItem.taskId).toBe(updateData.taskId);
    });

    it("should successfully update action item with empty taskId", async () => {
      const updateData = {
        taskId: "",
        title: "Updated Title",
        description: "Updated Description",
      };

      const result = await service.updateActionItem(
        actionItem.id,
        user,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.actionItem.taskId).toBe("");
    });

    it("should successfully update action item when updating existing taskId", async () => {
      // First update with a taskId
      await service.updateActionItem(actionItem.id, user, {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "First Update",
        description: "First Description",
      });

      // Then update with a different taskId
      const updateData = {
        taskId: "https://app.asana.com/0/123456/999999",
        title: "Second Update",
        description: "Second Description",
      };

      const result = await service.updateActionItem(
        actionItem.id,
        user,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.actionItem.taskId).toBe(updateData.taskId);
      expect(result.actionItem.title).toBe(updateData.title);
    });

    it("should throw error when user has no organization context", async () => {
      const userWithoutOrg = {
        ...user,
        currentOrganisation: null,
      };

      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: "Updated Description",
      };

      await expect(
        service.updateActionItem(actionItem.id, userWithoutOrg, updateData)
      ).rejects.toThrow("User organisation context not found");
    });

    it("should throw BadRequestException when action item not found", async () => {
      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: "Updated Description",
      };

      await expect(
        service.updateActionItem(99999, user, updateData)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateActionItem(99999, user, updateData)
      ).rejects.toThrow("Action item not found");
    });

    it("should throw ForbiddenException when action item belongs to different organization", async () => {
      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: "Updated Description",
      };

      await expect(
        service.updateActionItem(differentOrgActionItem.id, user, updateData)
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateActionItem(differentOrgActionItem.id, user, updateData)
      ).rejects.toThrow("You don't have access to this resource");
    });

    it("should throw ForbiddenException when meeting has no projects", async () => {
      // Create a meeting without projects
      const meetingWithoutProjects =
        await databaseService.client.meeting.create({
          data: {
            url: "https://meet.google.com/no-projects",
            name: "Meeting Without Projects",
            description: "No Projects",
            platform: MeetingPlatformSchemaName.GOOGLE_MEET,
            createdBy: user.id,
          },
        });

      const actionItemWithoutProjects =
        await databaseService.client.meetingActionItem.create({
          data: {
            meeting: { connect: { id: meetingWithoutProjects.id } },
            title: "No Projects Title",
            description: "No Projects Description",
          },
        });

      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: "Updated Description",
      };

      await expect(
        service.updateActionItem(actionItemWithoutProjects.id, user, updateData)
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateActionItem(actionItemWithoutProjects.id, user, updateData)
      ).rejects.toThrow("You don't have access to this resource");
    });

    it("should handle action item with multiple projects correctly", async () => {
      // Create another project in the same organisation
      const secondProject = await databaseService.client.project.create({
        data: {
          name: "Second Project",
          description: "Second project description",
          organisation: {
            connect: { id: user.currentOrganisation.id },
          },
        },
      });

      // Add the second project to the meeting
      await databaseService.client.projectMeeting.create({
        data: {
          projectId: secondProject.id,
          meetingId: meeting.id,
        },
      });

      const updateData = {
        taskId: "https://app.asana.com/0/123456/789012",
        title: "Updated Title",
        description: "Updated Description",
      };

      // Should still work - uses first project's organisationId
      const result = await service.updateActionItem(
        actionItem.id,
        user,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.actionItem.title).toBe(updateData.title);
    });
  });

  describe("endMeeting", () => {
    let meeting;

    beforeEach(async () => {
      meeting = await databaseService.client.meeting.create({
        data: {
          url: "https://meet.google.com/abc-defg-hij",
          name: "Test Meeting",
          description: "Test Description",
          platform: MeetingPlatformSchemaName.GOOGLE_MEET,
          createdBy: user.id,
        },
      });
    });

    it("notifies meeting end via LISTEN/NOTIFY", async () => {
      const result = await service.endMeeting(meeting.id.toString());
      expect(result.message).toBe("End command sent to bot");
      expect(result.meetingId).toBe(meeting.id.toString());
      expect(
        service["meetingNotifyService"].notifyMeetingEnd
      ).toHaveBeenCalledWith(meeting.id.toString());
    });

    it("throws BadRequestException when meeting not found", async () => {
      await expect(service.endMeeting("99999")).rejects.toThrow(
        BadRequestException
      );
      await expect(service.endMeeting("99999")).rejects.toThrow(
        "Meeting not found"
      );
    });
  });
});
