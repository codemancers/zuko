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
import {
  BadRequestException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskService } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { TasksController } from './tasks.controller';

describe('Task isSales HTTP validation', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    createTask: vi.fn(async (_org, dto) => ({ id: 1, ...dto })),
    updateTask: vi.fn(async (_org, id, dto) => ({ id, ...dto })),
  };

  beforeAll(async () => {
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
          req.organizationId = 7;
          req.user = { id: '11' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Match main.ts: exercise the actual controller metadata and HTTP pipe,
    // not direct controller calls that bypass request validation.
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
  });

  for (const method of ['POST', 'PATCH'] as const) {
    describe(method, () => {
      const invoke = (body: object) =>
        fetch(`${url}/tasks${method === 'PATCH' ? '/1' : ''}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const mock = method === 'POST' ? service.createTask : service.updateTask;

      it.each(
        ['true', 'false', 1, 0, null, {}, []].map((value) => ({ value })),
      )(
        'rejects nonboolean $value before calling service',
        async ({ value: isSales }) => {
          const response = await invoke({
            title: 'Keep existing fields',
            isSales,
          });
          const body = await response.json();
          expect(response.status).toBe(400);
          expect(body.message).toContain('isSales must be a boolean value');
          expect(mock).not.toHaveBeenCalled();
        },
      );

      it.each([true, false])(
        'accepts boolean %j without coercion',
        async (isSales) => {
          const response = await invoke({
            title: 'Keep existing fields',
            isSales,
          });
          expect(response.status).toBe(method === 'POST' ? 201 : 200);
          expect(await response.json()).toMatchObject({
            title: 'Keep existing fields',
            isSales,
          });
          const args = mock.mock.calls[0];
          expect(args[0]).toBe(7);
          expect(args[args.length - 1]).toBe(11);
        },
      );

      it('allows omission without supplying a false default on update', async () => {
        const response = await invoke({ title: 'Title-only change' });
        expect(response.status).toBe(method === 'POST' ? 201 : 200);
        const body = await response.json();
        expect(body.title).toBe('Title-only change');
        expect(body).not.toHaveProperty('isSales');
        expect(mock).toHaveBeenCalledOnce();
      });

      it.each(
        ['5', 0, -3, 1.5, true, {}, [], 'abc'].map((value) => ({ value })),
      )(
        'rejects non-positive-integer assigneeUserId $value before calling service',
        async ({ value: assigneeUserId }) => {
          const response = await invoke({ title: 'x', assigneeUserId });
          expect(response.status).toBe(400);
          expect(JSON.stringify((await response.json()).message)).toContain(
            'assigneeUserId',
          );
          expect(mock).not.toHaveBeenCalled();
        },
      );

      it.each(
        [2_147_483_648, Number.MAX_SAFE_INTEGER, 1e20].map((value) => ({
          value,
        })),
      )(
        'rejects assigneeUserId $value beyond the Int column range with 400',
        async ({ value: assigneeUserId }) => {
          const response = await invoke({ title: 'x', assigneeUserId });
          expect(response.status).toBe(400);
          expect(JSON.stringify((await response.json()).message)).toContain(
            'assigneeUserId',
          );
          expect(mock).not.toHaveBeenCalled();
        },
      );

      it.each([12, 2_147_483_647, null])(
        'passes assigneeUserId %j through unchanged',
        async (assigneeUserId) => {
          const response = await invoke({ title: 'x', assigneeUserId });
          expect(response.status).toBe(method === 'POST' ? 201 : 200);
          const dto = mock.mock.calls[0][method === 'POST' ? 1 : 2];
          expect(dto.assigneeUserId).toBe(assigneeUserId);
        },
      );

      it('leaves omitted assignment fields undefined so they are preserved', async () => {
        await invoke({ title: 'x' });
        const dto = mock.mock.calls[0][method === 'POST' ? 1 : 2];
        expect(dto.assigneeUserId).toBeUndefined();
        expect(dto.assignee).toBeUndefined();
      });

      describe.each(['contactId', 'prospectId'] as const)(
        'person reference %s',
        (field) => {
          const dtoOf = () => mock.mock.calls[0][method === 'POST' ? 1 : 2];

          it.each(
            [
              '5',
              0,
              -3,
              1.5,
              true,
              false,
              {},
              [],
              { connect: { id: 5 } },
              2_147_483_648,
              1e20,
            ].map((value) => ({ value })),
          )('rejects $value before calling service', async ({ value }) => {
            const response = await invoke({ title: 'x', [field]: value });
            expect(response.status).toBe(400);
            expect(JSON.stringify((await response.json()).message)).toContain(
              field,
            );
            expect(mock).not.toHaveBeenCalled();
          });

          it.each([12, 2_147_483_647, null])(
            'passes %j through unchanged',
            async (value) => {
              const response = await invoke({ title: 'x', [field]: value });
              expect(response.status).toBe(method === 'POST' ? 201 : 200);
              expect(dtoOf()[field]).toBe(value);
            },
          );
        },
      );

      it('leaves omitted person references undefined so they are preserved', async () => {
        await invoke({ title: 'x' });
        const dto = mock.mock.calls[0][method === 'POST' ? 1 : 2];
        expect(dto.contactId).toBeUndefined();
        expect(dto.prospectId).toBeUndefined();
      });

      it('rejects both contactId and prospectId in one request', async () => {
        const response = await invoke({
          title: 'x',
          contactId: 3,
          prospectId: 4,
        });
        expect(response.status).toBe(400);
        expect(JSON.stringify((await response.json()).message)).toContain(
          'contactId and prospectId',
        );
        expect(mock).not.toHaveBeenCalled();
      });

      it.each([
        { contactId: 3, prospectId: null },
        { contactId: null, prospectId: 4 },
        { contactId: null, prospectId: null },
      ])('accepts one reference with the other null: %j', async (refs) => {
        const response = await invoke({ title: 'x', ...refs });
        expect(response.status).toBe(method === 'POST' ? 201 : 200);
        expect(mock).toHaveBeenCalledOnce();
      });

      it('returns 400 when the service rejects a foreign-org assignee', async () => {
        mock.mockRejectedValueOnce(
          new BadRequestException(
            'Assignee user 99 is not a member of this organization',
          ),
        );
        const response = await invoke({ title: 'x', assigneeUserId: 99 });
        expect(response.status).toBe(400);
      });
    });
  }
});
