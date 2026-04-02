import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { MeetingService } from "./meeting.service";
import { PrismaService } from "../../prisma/prisma.service";
import { MeetingGateway } from "./meeting.gateway";
import { MeetingTranscriptIngestService } from "./meeting-transcript-ingest.service";
import { MeetingNotifyService } from "./meeting-notify.service";

describe("MeetingService", () => {
  let service: MeetingService;

  beforeEach(async () => {
    const mockPrisma = {
      meeting: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      meetingSummary: { findFirst: jest.fn(), create: jest.fn() },
      meetingActionItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockGateway = { sendEnd: jest.fn() };
    const mockIngest = { ingestChunk: jest.fn() };
    const mockNotify = { notifyMeetingEnd: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MeetingGateway, useValue: mockGateway },
        { provide: MeetingTranscriptIngestService, useValue: mockIngest },
        { provide: MeetingNotifyService, useValue: mockNotify },
      ],
    }).compile();

    service = module.get<MeetingService>(MeetingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
