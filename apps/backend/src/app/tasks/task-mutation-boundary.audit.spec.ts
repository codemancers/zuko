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
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskService } from '@zuko/sales';
import { TasksController } from './tasks.controller';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { PrismaService } from '../../prisma/prisma.service';

// Isolated HTTP probe: real controller and organization guard; fixture auth,
// membership and task-service spy. Never connects to a database or changes tasks.
describe('task mutation authorization prerequisite', () => {
  let app: INestApplication;
  let url: string;
  const member = {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  };
  beforeEach(() => {
    updateTask.mockClear();
    member.findFirst.mockReset().mockResolvedValue(null);
  });
  const updateTask = vi.fn().mockResolvedValue({ id: 434, status: 'DONE' });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        OrganizationGuard,
        { provide: TaskService, useValue: { updateTask } },
        {
          provide: PrismaService,
          useValue: {
            member,
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: '1' };
          req.session = {
            user: req.user,
            session: { activeOrganizationId: '7' },
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });
  it.each(['owner', 'admin', 'member'])(
    'preserves authorized %s task mutation',
    async (role) => {
      member.findFirst.mockResolvedValue({ role });
      const response = await fetch(`${url}/tasks/434`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: '2026-12-01' }),
      });
      expect(response.status).toBe(200);
      expect(updateTask).toHaveBeenCalledWith(
        7,
        434,
        { dueDate: '2026-12-01' },
        1,
      );
    },
  );
  it('rejects an explicit foreign organization instead of mutating a session-org task', async () => {
    member.findFirst.mockImplementation(async ({ where }) =>
      where.organizationId === 7 ? { role: 'owner' } : null,
    );
    const response = await fetch(`${url}/tasks/434`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': '8' },
      body: JSON.stringify({ status: 'DONE' }),
    });
    expect(response.status).toBe(403);
    expect(updateTask).not.toHaveBeenCalled();
  });
  it('rejects Done after membership is removed despite a stale active-organization session', async () => {
    const response = await fetch(`${url}/tasks/434`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-organization-id': '7' },
      body: JSON.stringify({ status: 'DONE' }),
    });
    expect(response.status).toBe(403);
    expect(updateTask).not.toHaveBeenCalled();
  });
});
