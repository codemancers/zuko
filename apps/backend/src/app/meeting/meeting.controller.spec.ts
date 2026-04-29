import { describe, it, expect, beforeEach } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { MeetingController } from "./meeting.controller";
import { MeetingService } from "./meeting.service";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import { OrganizationGuard } from "../../common/auth/organization.guard";

describe("MeetingController", () => {
  let controller: MeetingController;

  beforeEach(async () => {
    const mockMeetingService = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      webhook: vi.fn(),
      addTranscriptChunk: vi.fn(),
      getTranscript: vi.fn(),
      updateActionItem: vi.fn(),
      endMeeting: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeetingController],
      providers: [{ provide: MeetingService, useValue: mockMeetingService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MeetingController>(MeetingController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
