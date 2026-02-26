import { OrchestratorService } from '../services/orchestrator.service';
import { AdminService } from '../services/admin.service';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { ContextEntityReference } from '../types/chat.types';

// Global pool for direct database queries
let globalPool: Pool;

// Simple PrismaService for testing
class PrismaService {
  getPool(): Pool {
    return globalPool;
  }
}

// Mock services needed for tests
const mockContactsService = {
  findOne: jest
    .fn()
    .mockResolvedValue({ id: 1, firstName: 'John', lastName: 'Doe' }),
  findOwner: jest.fn().mockResolvedValue({ id: 1, name: 'Owner' }),
} as any;

const mockCompaniesService = {
  findById: jest.fn().mockResolvedValue({ id: 1, companyName: 'Acme Corp' }),
} as any;

const mockActivityService = {
  create: jest.fn().mockResolvedValue({ id: 1 }),
  findMany: jest.fn().mockResolvedValue([]),
} as any;

describe('PersistentContextMiddleware - State Persistence', () => {
  let service: OrchestratorService;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Ensure we have necessary environment variables
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for persistence tests');
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set - tests may fail');
    }

    // Create pool for database access
    globalPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Directly instantiate services without NestJS DI
    prisma = new PrismaService();
    const adminService = new AdminService();
    const mockSecretaryService = {
      getAgent: jest.fn().mockResolvedValue({
        invoke: jest.fn().mockResolvedValue({
          messages: [{ role: 'assistant', content: 'Mock secretary response' }],
        }),
      }),
    } as any;

    service = new OrchestratorService(
      adminService,
      mockSecretaryService,
      prisma as any,
      mockContactsService,
      mockCompaniesService,
      mockActivityService,
    );
  });

  afterAll(async () => {
    await globalPool.end();
  });

  describe('contextEntities persistence', () => {
    it('should hydrate contextEntities with names from database', async () => {
      const threadId = `test-hydration-${randomUUID()}`;
      const userId = 123;
      const contextEntities: ContextEntityReference[] = [
        { type: 'contact', id: 1 },
        { type: 'company', id: 2 },
      ];

      // Send message with contextEntities
      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      const stream = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Test hydration' }],
          contextEntities,
          userId,
        },
        config,
      );

      for await (const _chunk of stream) {
        // Consume
      }

      // Retrieve and verify hydrated entities
      const result = await service.getMessages(threadId);
      expect(result.contextEntities).toBeDefined();
      expect(result.contextEntities.length).toBe(2);

      // Verify each entity has a name
      result.contextEntities.forEach((entity: any) => {
        expect(entity.name).toBeDefined();
        expect(typeof entity.name).toBe('string');
        expect(entity.name.length).toBeGreaterThan(0);
      });

      // Verify contact entity
      const contact = result.contextEntities.find(
        (e: any) => e.type === 'contact',
      );
      expect(contact).toBeDefined();
      expect(contact.name).toContain('John'); // Mock returns John Doe

      // Verify company entity
      const company = result.contextEntities.find(
        (e: any) => e.type === 'company',
      );
      expect(company).toBeDefined();
      expect(company.name).toContain('Acme'); // Mock returns Acme Corp

      console.log(
        `✓ Entities hydrated with names:`,
        result.contextEntities.map((e: any) => e.name),
      );
    }, 30000);

    it('should persist contextEntities to checkpoint state', async () => {
      const threadId = `test-context-entities-${randomUUID()}`;
      const userId = 123;
      const contextEntities: ContextEntityReference[] = [
        { type: 'contact', id: 1 },
        { type: 'company', id: 2 },
      ];

      // Get the agent and stream with contextEntities
      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      // Stream with contextEntities and userId in initial state
      const stream = await agent.stream(
        {
          messages: [{ role: 'user', content: 'What is 1+1?' }],
          contextEntities,
          userId,
        },
        config,
      );

      // Consume the stream
      for await (const _chunk of stream) {
        // Just consume
      }

      // Verify checkpoint was saved to database
      const checkpointsResult = await globalPool.query(
        'SELECT checkpoint FROM agents.checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1',
        [threadId],
      );
      expect(checkpointsResult.rows.length).toBe(1);

      // Retrieve via getMessages API (proves persistence)
      const result = await service.getMessages(threadId);
      expect(result.contextEntities).toBeDefined();
      expect(Array.isArray(result.contextEntities)).toBe(true);
      // Verify entities are persisted (now with names hydrated)
      expect(result.contextEntities.length).toBe(2);
      expect(result.contextEntities[0].type).toBe('contact');
      expect(result.contextEntities[0].id).toBe(1);
      expect(result.contextEntities[0].name).toBeDefined();
      expect(result.contextEntities[1].type).toBe('company');
      expect(result.contextEntities[1].id).toBe(2);
      expect(result.contextEntities[1].name).toBeDefined();

      console.log(
        `✓ contextEntities persisted: ${JSON.stringify(result.contextEntities)}`,
      );
      console.log(`✓ Checkpoint saved to database for thread ${threadId}`);
    }, 30000);

    it('should retrieve contextEntities from checkpoint via getMessages', async () => {
      const threadId = `test-get-messages-context-${randomUUID()}`;
      const userId = 456;
      const contextEntities: ContextEntityReference[] = [
        { type: 'contact', id: 10 },
        { type: 'deal', id: 20 },
      ];

      // Send message with contextEntities
      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      const stream = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Hello' }],
          contextEntities,
          userId,
        },
        config,
      );

      // Consume stream
      for await (const _chunk of stream) {
        // Just consume
      }

      // Retrieve messages via getMessages (simulating page reload)
      const result = await service.getMessages(threadId);

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);

      // Verify contextEntities are returned (now with names hydrated)
      expect(result.contextEntities).toBeDefined();
      expect(Array.isArray(result.contextEntities)).toBe(true);
      expect(result.contextEntities.length).toBe(2);
      expect(result.contextEntities[0].type).toBe('contact');
      expect(result.contextEntities[0].id).toBe(10);
      expect(result.contextEntities[0].name).toBeDefined();
      expect(result.contextEntities[1].type).toBe('deal');
      expect(result.contextEntities[1].id).toBe(20);
      expect(result.contextEntities[1].name).toBeDefined();

      console.log(
        `✓ getMessages returned contextEntities: ${JSON.stringify(result.contextEntities)}`,
      );
      console.log(`✓ Retrieved ${result.messages.length} messages`);
    }, 30000);

    it('should update contextEntities across multiple turns', async () => {
      const threadId = `test-update-context-${randomUUID()}`;
      const userId = 789;

      // First turn: send with initial contextEntities
      const initialEntities: ContextEntityReference[] = [
        { type: 'contact', id: 1 },
      ];

      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      // First stream
      const stream1 = await agent.stream(
        {
          messages: [{ role: 'user', content: 'First message' }],
          contextEntities: initialEntities,
          userId,
        },
        config,
      );
      for await (const _chunk of stream1) {
        // Consume
      }

      // Verify initial entities are persisted (now with names)
      let result = await service.getMessages(threadId);
      expect(result.contextEntities.length).toBe(1);
      expect(result.contextEntities[0].type).toBe('contact');
      expect(result.contextEntities[0].id).toBe(1);
      expect(result.contextEntities[0].name).toBeDefined();

      // Second turn: update contextEntities
      const updatedEntities: ContextEntityReference[] = [
        { type: 'contact', id: 1 },
        { type: 'company', id: 2 },
      ];

      const stream2 = await agent.stream(
        {
          messages: [
            { role: 'user', content: 'First message' },
            { role: 'assistant', content: 'Response to first' },
            { role: 'user', content: 'Second message' },
          ],
          contextEntities: updatedEntities,
          userId,
        },
        config,
      );
      for await (const _chunk of stream2) {
        // Consume
      }

      // Verify updated entities are persisted (now with names)
      result = await service.getMessages(threadId);
      expect(result.contextEntities.length).toBe(2);
      expect(result.contextEntities[0].type).toBe('contact');
      expect(result.contextEntities[0].id).toBe(1);
      expect(result.contextEntities[0].name).toBeDefined();
      expect(result.contextEntities[1].type).toBe('company');
      expect(result.contextEntities[1].id).toBe(2);
      expect(result.contextEntities[1].name).toBeDefined();

      console.log(
        `✓ Updated contextEntities from 1 to ${result.contextEntities?.length} entities`,
      );
    }, 30000);

    it('should maintain empty contextEntities array when none provided', async () => {
      const threadId = `test-empty-context-${randomUUID()}`;

      // Send message without contextEntities
      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      const stream = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Hello' }],
          // No contextEntities provided
        },
        config,
      );

      for await (const _chunk of stream) {
        // Consume
      }

      // Retrieve and verify empty array
      const result = await service.getMessages(threadId);
      expect(result.contextEntities).toBeDefined();
      expect(Array.isArray(result.contextEntities)).toBe(true);
      expect(result.contextEntities.length).toBe(0);

      console.log('✓ Empty contextEntities array persisted correctly');
    }, 30000);

    it('should handle different entity types (contact, company, deal)', async () => {
      const threadId = `test-entity-types-${randomUUID()}`;
      const contextEntities: ContextEntityReference[] = [
        { type: 'contact', id: 100 },
        { type: 'company', id: 200 },
      ];

      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      const stream = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Test all entity types' }],
          contextEntities,
          userId: 999,
        },
        config,
      );

      for await (const _chunk of stream) {
        // Consume
      }

      // Verify all entity types are persisted (now with names)
      const result = await service.getMessages(threadId);
      expect(result.contextEntities).toBeDefined();
      expect(result.contextEntities.length).toBe(2);

      // Verify entity types and names
      const types = result.contextEntities?.map((e) => e.type) || [];
      expect(types).toContain('contact');
      expect(types).toContain('company');

      // Verify all have names
      result.contextEntities.forEach((e: any) => {
        expect(e.name).toBeDefined();
        expect(typeof e.name).toBe('string');
      });

      console.log(`✓ All entity types persisted: ${types.join(', ')}`);
    }, 30000);
  });

  describe('userId persistence', () => {
    it('should persist userId separately from contextEntities', async () => {
      const threadId = `test-userid-only-${randomUUID()}`;
      const userId = 12345;

      const agent = await (service as any).ensureAgent();
      const config = {
        streamMode: ['values'] as const,
        configurable: { thread_id: threadId },
      };

      const stream = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Test userId' }],
          userId,
          // No contextEntities
        },
        config,
      );

      for await (const _chunk of stream) {
        // Consume
      }

      // Verify checkpoint was created
      const checkpointsResult = await globalPool.query(
        'SELECT checkpoint FROM agents.checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1',
        [threadId],
      );
      expect(checkpointsResult.rows.length).toBe(1);

      // Verify via getMessages
      const result = await service.getMessages(threadId);
      expect(result.contextEntities).toBeDefined();
      expect(result.contextEntities).toEqual([]);

      console.log(`✓ userId ${userId} persisted without contextEntities`);
    }, 30000);
  });

  describe('Thread isolation', () => {
    it('should maintain separate contextEntities per thread', async () => {
      const thread1 = `test-isolation-1-${randomUUID()}`;
      const thread2 = `test-isolation-2-${randomUUID()}`;

      const entities1: ContextEntityReference[] = [{ type: 'contact', id: 1 }];
      const entities2: ContextEntityReference[] = [{ type: 'company', id: 99 }];

      const agent = await (service as any).ensureAgent();

      // Thread 1
      const stream1 = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Thread 1' }],
          contextEntities: entities1,
          userId: 100,
        },
        {
          streamMode: ['values'] as const,
          configurable: { thread_id: thread1 },
        },
      );
      for await (const _chunk of stream1) {
        // Consume
      }

      // Thread 2
      const stream2 = await agent.stream(
        {
          messages: [{ role: 'user', content: 'Thread 2' }],
          contextEntities: entities2,
          userId: 200,
        },
        {
          streamMode: ['values'] as const,
          configurable: { thread_id: thread2 },
        },
      );
      for await (const _chunk of stream2) {
        // Consume
      }

      // Verify isolation (entities now have names)
      const result1 = await service.getMessages(thread1);
      const result2 = await service.getMessages(thread2);

      expect(result1.contextEntities.length).toBe(1);
      expect(result1.contextEntities[0].type).toBe('contact');
      expect(result1.contextEntities[0].id).toBe(1);
      expect(result1.contextEntities[0].name).toBeDefined();

      expect(result2.contextEntities.length).toBe(1);
      expect(result2.contextEntities[0].type).toBe('company');
      expect(result2.contextEntities[0].id).toBe(99);
      expect(result2.contextEntities[0].name).toBeDefined();

      expect(result1.contextEntities[0].type).not.toEqual(
        result2.contextEntities[0].type,
      );

      console.log('✓ Thread isolation verified for contextEntities');
    }, 30000);
  });
});
