import { describe, it, expect, beforeEach } from "vitest";
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
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      meetingSummary: { findFirst: vi.fn(), create: vi.fn() },
      meetingActionItem: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    };

    const mockGateway = { sendEnd: vi.fn() };
    const mockIngest = { ingestChunk: vi.fn() };
    const mockNotify = { notifyMeetingEnd: vi.fn() };

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
