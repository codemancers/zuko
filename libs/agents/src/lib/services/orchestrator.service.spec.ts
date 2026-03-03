import { OrchestratorService } from "./orchestrator.service";
import { AdminService } from "./admin.service";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Global pool for direct database queries
let globalPool: Pool;

// Simple PrismaService for testing
class PrismaService {
  getPool(): Pool {
    return globalPool;
  }
}

describe("OrchestratorService - Persistence", () => {
  let service: OrchestratorService;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Ensure we have necessary environment variables
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for persistence tests");
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY not set - tests may fail");
    }

    // Create pool for database access
    globalPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Directly instantiate services without NestJS DI
    prisma = new PrismaService();
    const adminService = new AdminService();

    const mockContactsService = {
      findById: jest.fn().mockResolvedValue({ id: "1", name: "Test Contact" }),
    } as any;

    const mockCompaniesService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: "1", companyName: "Test Company" }),
    } as any;

    const mockActivityService = {} as any;

    service = new OrchestratorService(
      adminService,
      prisma as any,
      mockContactsService,
      mockCompaniesService,
      mockActivityService,
    );
  });

  afterAll(async () => {
    await globalPool.end();
  });

  describe("Checkpoint Persistence", () => {
    it("should initialize checkpointer with PostgresSaver", async () => {
      // Access the private checkpointer through ensureCheckpointer
      const checkpointer = await (service as any).ensureCheckpointer();

      expect(checkpointer).toBeDefined();
      expect(checkpointer.constructor.name).toBe("PostgresSaver");

      // Verify checkpoints table exists in database
      const result = await globalPool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'agents'
        AND table_name = 'checkpoints'
      `);
      expect(result.rows.length).toBe(1);
    });

    it("should persist conversation history across multiple messages", async () => {
      const threadId = `test-persistence-${randomUUID()}`;
      const firstMessage = [{ role: "user" as const, content: "What is 1+1?" }];
      const secondMessage = [
        { role: "user" as const, content: "What is 1+1?" },
        { role: "assistant" as const, content: "1+1 equals 2." },
        { role: "user" as const, content: "What about 2+2?" },
      ];

      // Send first message
      const firstReply = await service.generateReply(firstMessage, threadId);
      expect(firstReply).toBeDefined();
      expect(typeof firstReply).toBe("string");
      expect(firstReply.length).toBeGreaterThan(0);

      // Verify checkpoint was saved to database after first message
      const checkpointsAfterFirst = await globalPool.query(
        "SELECT * FROM agents.checkpoints WHERE thread_id = $1",
        [threadId],
      );
      expect(checkpointsAfterFirst.rows.length).toBeGreaterThan(0);

      // Send second message - agent should have context from first
      const secondReply = await service.generateReply(secondMessage, threadId);
      expect(secondReply).toBeDefined();
      expect(typeof secondReply).toBe("string");

      // Verify additional checkpoints were saved
      const checkpointsAfterSecond = await globalPool.query(
        "SELECT * FROM agents.checkpoints WHERE thread_id = $1",
        [threadId],
      );
      expect(checkpointsAfterSecond.rows.length).toBeGreaterThan(
        checkpointsAfterFirst.rows.length,
      );

      // Retrieve conversation history from checkpoint
      const { messages } = await service.getMessages(threadId);
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // Verify messages contain user and assistant messages
      const userMessages = messages.filter((m) => m.role === "user");
      const assistantMessages = messages.filter((m) => m.role === "assistant");

      expect(userMessages.length).toBeGreaterThan(0);
      expect(assistantMessages.length).toBeGreaterThan(0);

      console.log(
        `✓ Persisted ${messages.length} messages for thread ${threadId}`,
      );
      console.log(
        `✓ Database has ${checkpointsAfterSecond.rows.length} checkpoints for thread`,
      );
    }, 30000); // 30s timeout for API calls

    it("should retrieve conversation history from database", async () => {
      const threadId = `test-history-${randomUUID()}`;

      // Send a message to create checkpoint
      await service.generateReply(
        [{ role: "user" as const, content: "Hello, this is a test" }],
        threadId,
      );

      // Verify checkpoint exists in database
      const dbCheckpoints = await globalPool.query(
        "SELECT checkpoint FROM agents.checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1",
        [threadId],
      );
      expect(dbCheckpoints.rows.length).toBe(1);
      expect(dbCheckpoints.rows[0].checkpoint).toBeDefined();
      // Checkpoint is stored as JSONB, verify it has data
      const checkpoint = dbCheckpoints.rows[0].checkpoint;
      expect(typeof checkpoint).toBe("object");

      // Retrieve messages
      const { messages } = await service.getMessages(threadId);

      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // Verify message structure
      messages.forEach((msg) => {
        expect(msg).toHaveProperty("role");
        expect(msg).toHaveProperty("content");
        expect(["user", "assistant", "system"]).toContain(msg.role);
        expect(typeof msg.content).toBe("string");
      });

      console.log(`✓ Retrieved ${messages.length} messages from checkpoint`);
    }, 30000);

    it("should return empty array for non-existent thread", async () => {
      const nonExistentThreadId = `non-existent-${randomUUID()}`;
      const { messages } = await service.getMessages(nonExistentThreadId);

      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(0);
    });

    it("should maintain separate conversation histories per thread", async () => {
      const thread1 = `test-thread-1-${randomUUID()}`;
      const thread2 = `test-thread-2-${randomUUID()}`;

      // Send different messages to different threads
      await service.generateReply(
        [{ role: "user" as const, content: "Thread 1 message" }],
        thread1,
      );
      await service.generateReply(
        [{ role: "user" as const, content: "Thread 2 message" }],
        thread2,
      );

      // Verify separate checkpoints in database
      const thread1Checkpoints = await globalPool.query(
        "SELECT * FROM agents.checkpoints WHERE thread_id = $1",
        [thread1],
      );
      const thread2Checkpoints = await globalPool.query(
        "SELECT * FROM agents.checkpoints WHERE thread_id = $1",
        [thread2],
      );
      expect(thread1Checkpoints.rows.length).toBeGreaterThan(0);
      expect(thread2Checkpoints.rows.length).toBeGreaterThan(0);

      // Retrieve messages from each thread
      const { messages: messages1 } = await service.getMessages(thread1);
      const { messages: messages2 } = await service.getMessages(thread2);

      expect(messages1).toBeDefined();
      expect(messages2).toBeDefined();
      expect(messages1.length).toBeGreaterThan(0);
      expect(messages2.length).toBeGreaterThan(0);

      // Verify messages are different
      const thread1Content = messages1.map((m) => m.content).join(" ");
      const thread2Content = messages2.map((m) => m.content).join(" ");

      expect(thread1Content).toContain("Thread 1");
      expect(thread2Content).toContain("Thread 2");
      expect(thread1Content).not.toContain("Thread 2");
      expect(thread2Content).not.toContain("Thread 1");

      console.log(
        `✓ Thread isolation verified: ${messages1.length} vs ${messages2.length} messages`,
      );
      console.log(
        `✓ Database: thread1 has ${thread1Checkpoints.rows.length}, thread2 has ${thread2Checkpoints.rows.length} checkpoints`,
      );
    }, 30000);
  });

  describe("initThread", () => {
    it("should initialize a new thread with checkpoint", async () => {
      const result = await service.initThread({});

      expect(result).toBeDefined();
      expect(result.threadId).toBeDefined();
      expect(typeof result.threadId).toBe("string");

      // Verify checkpoint exists in database
      const dbCheckpoints = await globalPool.query(
        "SELECT * FROM agents.checkpoints WHERE thread_id = $1",
        [result.threadId],
      );
      expect(dbCheckpoints.rows.length).toBeGreaterThan(0);

      // Verify checkpoint was created
      const { messages } = await service.getMessages(result.threadId);
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);

      console.log(
        `✓ Initialized thread ${result.threadId} with ${dbCheckpoints.rows.length} checkpoint(s)`,
      );
    }, 30000);

    it("should use provided threadId when initializing", async () => {
      const customThreadId = `custom-thread-${randomUUID()}`;
      const result = await service.initThread({ threadId: customThreadId });

      expect(result.threadId).toBe(customThreadId);

      // Verify checkpoint exists in database for custom thread
      const dbCheckpoints = await globalPool.query(
        "SELECT * FROM agents.checkpoints WHERE thread_id = $1",
        [customThreadId],
      );
      expect(dbCheckpoints.rows.length).toBeGreaterThan(0);

      console.log(
        `✓ Custom thread ${customThreadId} initialized with ${dbCheckpoints.rows.length} checkpoint(s)`,
      );
    }, 30000);
  });
});
