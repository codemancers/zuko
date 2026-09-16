import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  ActivityService,
  DealsService,
  CompaniesService,
  ContactsService,
  TaskService,
} from '@zuko/sales';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import {
  ActivitiesController,
  ContactActivitiesController,
  CompanyActivitiesController,
  DealActivitiesController,
  TaskActivitiesController,
} from './activities.controller';

const ORG_ID = 1;
const OTHER_ORG_ID = 2;
const mockReq = { user: { id: '42' } } as any;

/** Verifies every route checks the underlying entity's org before touching ActivityService. */
describe('Activities cross-org access', () => {
  const mockActivityService = {
    findAll: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    getTimeline: vi.fn(),
    createComment: vi.fn(),
  };
  const mockDealsService = { findById: vi.fn() };
  const mockCompaniesService = { findById: vi.fn() };
  const mockContactsService = { findById: vi.fn() };
  const mockTaskService = { getTaskById: vi.fn() };

  async function buildModule() {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        ActivitiesController,
        ContactActivitiesController,
        CompanyActivitiesController,
        DealActivitiesController,
        TaskActivitiesController,
      ],
      providers: [
        { provide: ActivityService, useValue: mockActivityService },
        { provide: DealsService, useValue: mockDealsService },
        { provide: CompaniesService, useValue: mockCompaniesService },
        { provide: ContactsService, useValue: mockContactsService },
        { provide: TaskService, useValue: mockTaskService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();
    return module;
  }

  let module: TestingModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    module = await buildModule();
  });

  describe('nested per-entity controllers', () => {
    it('DealActivitiesController.getTimeline verifies the deal is in the caller org first', async () => {
      const controller = module.get(DealActivitiesController);
      mockDealsService.findById.mockResolvedValue({
        id: 7,
        organizationId: ORG_ID,
      });
      mockActivityService.getTimeline.mockResolvedValue({ activities: [] });

      await controller.getTimeline(ORG_ID, 7);

      expect(mockDealsService.findById).toHaveBeenCalledWith(7, ORG_ID);
      expect(mockActivityService.getTimeline).toHaveBeenCalledWith(
        'deal',
        7,
        undefined,
      );
    });

    it('DealActivitiesController.getTimeline propagates NotFoundException for a cross-org deal id', async () => {
      const controller = module.get(DealActivitiesController);
      mockDealsService.findById.mockRejectedValue(
        new NotFoundException('Deal with ID 7 not found'),
      );

      await expect(controller.getTimeline(OTHER_ORG_ID, 7)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockActivityService.getTimeline).not.toHaveBeenCalled();
    });

    it('DealActivitiesController.createComment verifies org access before writing', async () => {
      const controller = module.get(DealActivitiesController);
      mockDealsService.findById.mockRejectedValue(
        new NotFoundException('Deal with ID 7 not found'),
      );

      await expect(
        controller.createComment(mockReq, OTHER_ORG_ID, 7, { content: 'hi' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockActivityService.createComment).not.toHaveBeenCalled();
    });

    it('ContactActivitiesController.createComment succeeds for a same-org contact', async () => {
      const controller = module.get(ContactActivitiesController);
      mockContactsService.findById.mockResolvedValue({
        id: 3,
        organizationId: ORG_ID,
      });
      mockActivityService.createComment.mockResolvedValue({ id: 501 });

      await controller.createComment(mockReq, ORG_ID, 3, { content: 'hi' });

      expect(mockContactsService.findById).toHaveBeenCalledWith(3, ORG_ID);
      expect(mockActivityService.createComment).toHaveBeenCalledWith(
        'contact',
        3,
        42,
        'hi',
      );
    });

    it('CompanyActivitiesController.getTimeline verifies org access', async () => {
      const controller = module.get(CompanyActivitiesController);
      mockCompaniesService.findById.mockRejectedValue(
        new NotFoundException('Company with ID 9 not found'),
      );

      await expect(controller.getTimeline(OTHER_ORG_ID, 9)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockActivityService.getTimeline).not.toHaveBeenCalled();
    });

    it('TaskActivitiesController.createComment verifies org access via TaskService.getTaskById', async () => {
      const controller = module.get(TaskActivitiesController);
      mockTaskService.getTaskById.mockRejectedValue(
        new NotFoundException('Task with ID 4 not found'),
      );

      await expect(
        controller.createComment(mockReq, OTHER_ORG_ID, 4, { content: 'hi' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockTaskService.getTaskById).toHaveBeenCalledWith(OTHER_ORG_ID, 4);
      expect(mockActivityService.createComment).not.toHaveBeenCalled();
    });
  });

  describe('generic ActivitiesController', () => {
    it('list requires entityType and entityId', async () => {
      const controller = module.get(ActivitiesController);
      await expect(
        controller.list(ORG_ID, { activityType: 'comment' } as any),
      ).rejects.toThrow('entityType and entityId are required');
      expect(mockActivityService.findAll).not.toHaveBeenCalled();
    });

    it('list rejects a cross-org entityId', async () => {
      const controller = module.get(ActivitiesController);
      mockDealsService.findById.mockRejectedValue(
        new NotFoundException('Deal with ID 7 not found'),
      );

      await expect(
        controller.list(OTHER_ORG_ID, {
          entityType: 'deal',
          entityId: 7,
        } as any),
      ).rejects.toThrow(NotFoundException);
      expect(mockActivityService.findAll).not.toHaveBeenCalled();
    });

    it('findOne resolves the activity, then verifies the underlying entity org', async () => {
      const controller = module.get(ActivitiesController);
      mockActivityService.findById.mockResolvedValue({
        id: 500,
        entityType: 'company',
        entityId: 9,
      });
      mockCompaniesService.findById.mockRejectedValue(
        new NotFoundException('Company with ID 9 not found'),
      );

      await expect(controller.findOne(OTHER_ORG_ID, 500)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('update verifies org access before delegating to ActivityService.update', async () => {
      const controller = module.get(ActivitiesController);
      mockActivityService.findById.mockResolvedValue({
        id: 500,
        entityType: 'contact',
        entityId: 3,
      });
      mockContactsService.findById.mockResolvedValue({
        id: 3,
        organizationId: ORG_ID,
      });
      mockActivityService.update.mockResolvedValue({
        id: 500,
        content: 'edited',
      });

      await controller.update(mockReq, ORG_ID, 500, { content: 'edited' });

      expect(mockActivityService.update).toHaveBeenCalledWith(
        500,
        42,
        'edited',
      );
    });

    it('delete verifies org access before delegating to ActivityService.delete', async () => {
      const controller = module.get(ActivitiesController);
      mockActivityService.findById.mockResolvedValue({
        id: 500,
        entityType: 'task',
        entityId: 4,
      });
      mockTaskService.getTaskById.mockRejectedValue(
        new NotFoundException('Task with ID 4 not found'),
      );

      await expect(
        controller.delete(mockReq, OTHER_ORG_ID, 500),
      ).rejects.toThrow(NotFoundException);
      expect(mockActivityService.delete).not.toHaveBeenCalled();
    });

    it('rejects an unsupported entityType', async () => {
      const controller = module.get(ActivitiesController);
      await expect(
        controller.list(ORG_ID, { entityType: 'icp', entityId: 1 } as any),
      ).rejects.toThrow('Unsupported entity type: icp');
    });
  });
});
