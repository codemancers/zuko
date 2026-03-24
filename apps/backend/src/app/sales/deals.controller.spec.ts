import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DealsController, CreateDealDto } from './deals.controller';
import { DealsService } from '@zuko/sales';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { OrganizationGuard } from '../../common/auth/organization.guard';

const TEST_ORGANIZATION_ID = 1;
const mockReq = { user: { id: '1' } } as any;

describe('DealsController', () => {
  let controller: DealsController;

  const mockDealsService = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    hide: jest.fn(),
    unhide: jest.fn(),
    addOwner: jest.fn(),
    removeOwner: jest.fn(),
    setPrimaryOwner: jest.fn(),
    getDealsByOwner: jest.fn(),
    addCompany: jest.fn(),
    removeCompany: jest.fn(),
    updateCompany: jest.fn(),
    getCompanies: jest.fn(),
    addContact: jest.fn(),
    removeContact: jest.fn(),
    updateContact: jest.fn(),
    getContacts: jest.fn(),
    getDealsByCompany: jest.fn(),
    getDealsByContact: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealsController],
      providers: [
        {
          provide: DealsService,
          useValue: mockDealsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DealsController>(DealsController);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should convert expectedCloseDate string to Date object before passing to service', async () => {
      const dto: CreateDealDto = {
        title: 'Test Deal',
        value: 1000,
        currency: 'USD',
        probability: 50,
        stage: 'prospecting',
        expectedCloseDate: '2026-02-25' as unknown as Date, // JSON sends string; controller converts to Date
        priority: 2,
        ownerIds: [1],
      };

      const mockCreatedDeal = {
        id: 1,
        ...dto,
        expectedCloseDate: new Date('2026-02-25'),
        createdAt: new Date(),
        updatedAt: new Date(),
        owners: [],
        companies: [],
        contacts: [],
      };

      (mockDealsService.create as jest.Mock).mockResolvedValue(
        mockCreatedDeal as never,
      );

      await controller.create(mockReq, TEST_ORGANIZATION_ID, dto);

      // Check that the service was called with a Date object, not a string
      expect(mockDealsService.create).toHaveBeenCalledTimes(1);
      const callArg = mockDealsService.create.mock.calls[0][0] as {
        expectedCloseDate?: Date;
      };

      // This is the bug: expectedCloseDate should be a Date object
      expect(callArg.expectedCloseDate).toBeInstanceOf(Date);
      expect((callArg.expectedCloseDate as Date).toISOString()).toContain(
        '2026-02-25',
      );
    });

    it('should handle undefined expectedCloseDate', async () => {
      const dto: CreateDealDto = {
        title: 'Test Deal',
        value: 1000,
        currency: 'USD',
        probability: 50,
        stage: 'prospecting',
        priority: 2,
        ownerIds: [1],
      };

      const mockCreatedDeal = {
        id: 1,
        ...dto,
        createdAt: new Date(),
        updatedAt: new Date(),
        owners: [],
        companies: [],
        contacts: [],
      };

      (mockDealsService.create as jest.Mock).mockResolvedValue(
        mockCreatedDeal as never,
      );

      await controller.create(mockReq, TEST_ORGANIZATION_ID, dto);

      expect(mockDealsService.create).toHaveBeenCalledTimes(1);
      const callArg = mockDealsService.create.mock.calls[0][0] as {
        expectedCloseDate?: Date;
      };
      expect(callArg.expectedCloseDate).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should convert date strings to Date objects before passing to service', async () => {
      const dealId = 1;
      const dto = {
        expectedCloseDate: '2026-03-15' as unknown as Date,
        actualCloseDate: '2026-03-10' as unknown as Date,
        stage: 'closed_won',
      };

      const mockUpdatedDeal = {
        id: dealId,
        title: 'Test Deal',
        ...dto,
        expectedCloseDate: new Date('2026-03-15'),
        actualCloseDate: new Date('2026-03-10'),
        owners: [],
      };

      (mockDealsService.update as jest.Mock).mockResolvedValue(
        mockUpdatedDeal as never,
      );

      await controller.update(mockReq, TEST_ORGANIZATION_ID, dealId, dto);

      expect(mockDealsService.update).toHaveBeenCalledTimes(1);
      const [id, orgId, callArg] = mockDealsService.update.mock.calls[0] as [
        number,
        number,
        { expectedCloseDate?: Date; actualCloseDate?: Date },
      ];

      expect(id).toBe(dealId);
      expect(orgId).toBe(TEST_ORGANIZATION_ID);
      expect(callArg.expectedCloseDate).toBeInstanceOf(Date);
      expect(callArg.actualCloseDate).toBeInstanceOf(Date);
      expect((callArg.expectedCloseDate as Date).toISOString()).toContain(
        '2026-03-15',
      );
      expect((callArg.actualCloseDate as Date).toISOString()).toContain(
        '2026-03-10',
      );
    });

    it('should handle undefined date fields', async () => {
      const dealId = 1;
      const dto = {
        stage: 'prospecting',
      };

      const mockUpdatedDeal = {
        id: dealId,
        title: 'Test Deal',
        ...dto,
        owners: [],
      };

      (mockDealsService.update as jest.Mock).mockResolvedValue(
        mockUpdatedDeal as never,
      );

      await controller.update(mockReq, TEST_ORGANIZATION_ID, dealId, dto);

      expect(mockDealsService.update).toHaveBeenCalledTimes(1);
      const [, , callArg] = mockDealsService.update.mock.calls[0] as [
        number,
        number,
        { expectedCloseDate?: Date; actualCloseDate?: Date },
      ];

      expect(callArg.expectedCloseDate).toBeUndefined();
      expect(callArg.actualCloseDate).toBeUndefined();
    });
  });
});
