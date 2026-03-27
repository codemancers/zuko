import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Test, TestingModule } from "@nestjs/testing";
import { MeetingController } from "./meeting.controller";
import { MeetingService } from "./meeting.service";
import { AuthGuard } from "@thallesp/nestjs-better-auth";
import { OrganizationGuard } from "../../common/auth/organization.guard";

describe("MeetingController", () => {
  let controller: MeetingController;

  beforeEach(async () => {
    const mockMeetingService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      webhook: jest.fn(),
      addTranscriptChunk: jest.fn(),
      getTranscript: jest.fn(),
      updateActionItem: jest.fn(),
      endMeeting: jest.fn(),
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
