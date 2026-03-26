jest.mock("@langchain/langgraph-sdk", () => ({
  Client: jest.fn().mockImplementation(() => ({
    runs: { create: jest.fn(), get: jest.fn(), wait: jest.fn(), stream: jest.fn() },
    threads: { create: jest.fn(), get: jest.fn(), update: jest.fn(), delete: jest.fn() },
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { MeetingController } from "./meeting.controller";
import { MeetingService } from "./meeting.service";
import { AuthService, OrganisationService } from "@gather/core";
import { SchedulerService } from "@gather/shared";

import { DatabaseService } from "@gather/prisma";
import { AgentUserService } from "../../common/services/agent-user.service";

// Mock DatabaseService
const mockDatabaseService = {
  client: {
    meeting: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    projectMeeting: {
      findMany: jest.fn(),
    },
  },
};

// Mock SchedulerService
const mockSchedulerService = {
  scheduleJob: jest.fn(),
  cancelJob: jest.fn(),
  rescheduleJob: jest.fn(),
  createSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
};

// Mock OrganisationService
const mockOrganisationService = {
  create: jest.fn(),
  findAllOrganisations: jest.fn(),
  findOrganisationById: jest.fn(),
  updateOrganisation: jest.fn(),
  removeOrganisation: jest.fn(),
  getWorkspaceIdFromOrganisationConnections: jest.fn(),
  getBotTokenFromOrganisationConnections: jest.fn(),
};

// Mock AuthService
const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  createAccessToken: jest.fn(),
};

// Mock MeetingService
const mockMeetingService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  webhook: jest.fn(),
};

// Mock AgentUserService (required by AgentGuard used by MeetingController)
const mockAgentUserService = {
  findUserById: jest.fn(),
  findProjectById: jest.fn(),
};

describe("MeetingController", () => {
  let controller: MeetingController;
  let meetingService: MeetingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeetingController],
      providers: [
        {
          provide: MeetingService,
          useValue: mockMeetingService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: "DB",
          useValue: mockDatabaseService.client,
        },
        {
          provide: SchedulerService,
          useValue: mockSchedulerService,
        },
        {
          provide: OrganisationService,
          useValue: mockOrganisationService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AgentUserService,
          useValue: mockAgentUserService,
        },
      ],
    }).compile();

    controller = module.get<MeetingController>(MeetingController);
    meetingService = module.get<MeetingService>(MeetingService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should have all required methods", () => {
    expect(controller.create).toBeDefined();
    expect(controller.findAll).toBeDefined();
    expect(controller.findOne).toBeDefined();
    expect(controller.update).toBeDefined();
    expect(controller.remove).toBeDefined();
    expect(controller.webhook).toBeDefined();
  });
});
