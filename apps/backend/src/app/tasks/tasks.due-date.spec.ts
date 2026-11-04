import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskRepository, TaskService, type PrismaService } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { TasksController } from './tasks.controller';

const ORG_ID = 7;
const USER_ID = 11;

// Real controller + ValidationPipe + TaskService + TaskRepository over a mocked
// Prisma client, so the response bodies show what the API actually emits.
describe('Task dueDate HTTP contract', () => {
  let app: INestApplication;
  let url: string;
  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    organizationId: ORG_ID,
    title: 'Task',
    status: 'TODO',
    priority: 'MEDIUM',
    isSales: false,
    completedAt: null,
    dueDate: new Date('2026-11-03T00:00:00.000Z'),
    parentId: null,
    assignee: null,
    assigneeUserId: null,
    assigneeUser: null,
    contactId: null,
    prospectId: null,
    contact: null,
    prospect: null,
    owners: [],
    subtasks: [
      {
        id: 2,
        organizationId: ORG_ID,
        title: 'Sub',
        parentId: 1,
        dueDate: new Date('2024-02-29T00:00:00.000Z'),
      },
    ],
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides,
  });
  const prisma = {
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    taskOwner: { create: vi.fn() },
    member: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    prospect: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  beforeAll(async () => {
    const repository = new TaskRepository(prisma as unknown as PrismaService);
    const service = new TaskService(repository, {
      emitAsync: async () => [],
    } as unknown as EventEmitter2);
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TaskService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.organizationId = ORG_ID;
          req.user = { id: String(USER_ID) };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Match main.ts.
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, forbidUnknownValues: false }),
    );
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.task.create.mockResolvedValue(stored());
    prisma.task.findUniqueOrThrow.mockResolvedValue(stored());
    prisma.task.findFirst.mockResolvedValue(stored());
    prisma.task.update.mockResolvedValue(stored());
    prisma.task.findMany.mockResolvedValue([
      stored(),
      stored({ id: 3, dueDate: null, subtasks: [] }),
    ]);
    prisma.task.count.mockResolvedValue(2);
  });

  const send = (method: 'POST' | 'PATCH', body: unknown) =>
    fetch(`${url}/tasks${method === 'PATCH' ? '/1' : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const writeData = (method: 'POST' | 'PATCH') =>
    (method === 'POST' ? prisma.task.create : prisma.task.update).mock
      .calls[0][0].data;

  describe('responses emit date-only strings', () => {
    it('on create', async () => {
      const response = await send('POST', {
        title: 'Due',
        dueDate: '2026-11-03',
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.dueDate).toBe('2026-11-03');
      expect(body.subtasks[0].dueDate).toBe('2024-02-29');
    });

    it('on detail', async () => {
      const body = await (await fetch(`${url}/tasks/1`)).json();
      expect(body.dueDate).toBe('2026-11-03');
      expect(body.subtasks[0].dueDate).toBe('2024-02-29');
    });

    it('on list, with null kept for undated tasks', async () => {
      const body = await (await fetch(`${url}/tasks`)).json();
      expect(body.tasks.map((t: { dueDate: unknown }) => t.dueDate)).toEqual([
        '2026-11-03',
        null,
      ]);
      expect(body.tasks[0].subtasks[0].dueDate).toBe('2024-02-29');
    });

    it('on update', async () => {
      const response = await send('PATCH', { dueDate: '2026-11-03' });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.dueDate).toBe('2026-11-03');
      expect(body.subtasks[0].dueDate).toBe('2024-02-29');
    });
  });

  for (const method of ['POST', 'PATCH'] as const) {
    describe(method, () => {
      const ok = method === 'POST' ? 201 : 200;

      it.each(['2026-11-03', '2024-02-29', '0001-01-01', '9999-12-31'])(
        'stores %s as UTC midnight',
        async (dueDate) => {
          const response = await send(method, { title: 'x', dueDate });
          expect(response.status).toBe(ok);
          expect(writeData(method).dueDate.toISOString()).toBe(
            `${dueDate}T00:00:00.000Z`,
          );
        },
      );

      it('writes null for explicit null', async () => {
        const response = await send(method, { title: 'x', dueDate: null });
        expect(response.status).toBe(ok);
        expect(writeData(method).dueDate).toBeNull();
      });

      it('does not write the column when dueDate is omitted', async () => {
        const response = await send(method, { title: 'x' });
        expect(response.status).toBe(ok);
        expect(writeData(method)).not.toHaveProperty('dueDate');
      });

      it.each(
        [
          '',
          '2026-02-29',
          '1900-02-29',
          '2026-04-31',
          '2026-13-01',
          '0000-01-01',
          '2026-11-3',
          '2026-11-03T00:00:00Z',
          '2026-11-03T00:00:00.000Z',
          '2026-11-03T00:00:00+05:30',
          'not-a-date',
          20261103,
          true,
          false,
          [],
          ['2026-11-03'],
          {},
          { date: '2026-11-03' },
        ].map((value) => ({ value })),
      )('rejects $value with 400 before any write', async ({ value }) => {
        const response = await send(method, { title: 'x', dueDate: value });
        expect(response.status).toBe(400);
        expect(JSON.stringify((await response.json()).message)).toContain(
          'dueDate',
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.task.create).not.toHaveBeenCalled();
        expect(prisma.task.update).not.toHaveBeenCalled();
      });
    });
  }
});
