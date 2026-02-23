import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DealsController, CreateDealDto } from './deals.controller';
import { DealsService } from '@zuko/sales';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

describe('DealsController', () => {
  let controller: DealsController;
  let dealsService: DealsService;

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
    getDealsByUser: jest.fn(),
    addAccount: jest.fn(),
    removeAccount: jest.fn(),
    updateAccount: jest.fn(),
    getAccounts: jest.fn(),
    addContact: jest.fn(),
    removeContact: jest.fn(),
    updateContact: jest.fn(),
    getContacts: jest.fn(),
    getDealsByAccount: jest.fn(),
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
      .compile();

    controller = module.get<DealsController>(DealsController);
    dealsService = module.get<DealsService>(DealsService);

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
        expectedCloseDate: '2026-02-25' as any, // This is how it comes from JSON
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
        accounts: [],
        contacts: [],
      };

      mockDealsService.create.mockResolvedValue(mockCreatedDeal);

      await controller.create(dto);

      // Check that the service was called with a Date object, not a string
      expect(mockDealsService.create).toHaveBeenCalledTimes(1);
      const callArg = mockDealsService.create.mock.calls[0][0];

      // This is the bug: expectedCloseDate should be a Date object
      expect(callArg.expectedCloseDate).toBeInstanceOf(Date);
      expect(callArg.expectedCloseDate.toISOString()).toContain('2026-02-25');
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
        accounts: [],
        contacts: [],
      };

      mockDealsService.create.mockResolvedValue(mockCreatedDeal);

      await controller.create(dto);

      expect(mockDealsService.create).toHaveBeenCalledTimes(1);
      const callArg = mockDealsService.create.mock.calls[0][0];
      expect(callArg.expectedCloseDate).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should convert date strings to Date objects before passing to service', async () => {
      const dealId = 1;
      const dto = {
        expectedCloseDate: '2026-03-15' as any,
        actualCloseDate: '2026-03-10' as any,
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

      mockDealsService.update.mockResolvedValue(mockUpdatedDeal);

      await controller.update(dealId, dto);

      expect(mockDealsService.update).toHaveBeenCalledTimes(1);
      const [id, callArg] = mockDealsService.update.mock.calls[0];

      expect(id).toBe(dealId);
      expect(callArg.expectedCloseDate).toBeInstanceOf(Date);
      expect(callArg.actualCloseDate).toBeInstanceOf(Date);
      expect(callArg.expectedCloseDate.toISOString()).toContain('2026-03-15');
      expect(callArg.actualCloseDate.toISOString()).toContain('2026-03-10');
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

      mockDealsService.update.mockResolvedValue(mockUpdatedDeal);

      await controller.update(dealId, dto);

      expect(mockDealsService.update).toHaveBeenCalledTimes(1);
      const [, callArg] = mockDealsService.update.mock.calls[0];

      expect(callArg.expectedCloseDate).toBeUndefined();
      expect(callArg.actualCloseDate).toBeUndefined();
    });
  });
});
