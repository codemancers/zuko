import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesOverviewModule } from './sales-overview.module';

// Opt-in only: ZUKO_PREVIEW_DB_TESTS=1, with the local preview DATABASE_URL.
// The real repository and authorization guard run over persisted rows. Only
// authentication is a fixture. All fixture writes roll back, even on failure.
describe.skipIf(process.env.ZUKO_PREVIEW_DB_TESTS !== '1')(
  'Needs attention persisted HTTP query',
  () => {
    it('filters, paginates, deduplicates and reflects membership changes without writes on reads', async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString)
        throw new Error('Local preview DATABASE_URL required');
      const url = new URL(connectionString);
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.pathname !== '/zuko_cm_preview'
      ) {
        throw new Error('Refusing database other than local zuko_cm_preview');
      }
      const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
      });
      const rollback = new Error('ROLLBACK_SUCCESSFUL_VERIFICATION');
      const suffix = crypto.randomUUID();
      let app: INestApplication | undefined;
      try {
        await prisma.$transaction(
          async (tx) => {
            const org = await tx.organization.create({
              data: {
                name: '7370 verification',
                slug: `7370-${suffix}`,
                createdAt: new Date(),
              },
            });
            const otherOrg = await tx.organization.create({
              data: {
                name: '7370 foreign',
                slug: `7370-foreign-${suffix}`,
                createdAt: new Date(),
              },
            });
            const users = [];
            for (const [index, role] of [
              'owner',
              'admin',
              'admin',
              'member',
              'admin',
            ].entries()) {
              // eslint-disable-next-line no-await-in-loop -- Keep fixture identity order explicit within one transaction.
              const user = await tx.user.create({
                data: {
                  name: 'Same name',
                  email: `7370-${suffix}-${index}@example.invalid`,
                },
              });
              users.push(user);
              // eslint-disable-next-line no-await-in-loop -- Membership depends on the fixture user just created.
              await tx.member.create({
                data: {
                  organizationId: index === 4 ? otherOrg.id : org.id,
                  userId: user.id,
                  role,
                  createdAt: new Date(),
                },
              });
            }
            // Duplicate membership rows are legal in the legacy schema.
            await tx.member.create({
              data: {
                organizationId: org.id,
                userId: users[1].id,
                role: 'admin',
                createdAt: new Date(),
              },
            });
            const makeTask = (
              title: string,
              overrides: Partial<Prisma.TaskUncheckedCreateInput> = {},
            ) =>
              tx.task.create({
                data: {
                  organizationId: org.id,
                  title,
                  isSales: true,
                  status: 'TODO',
                  assigneeUserId: users[1].id,
                  dueDate: new Date('2026-11-01T00:00:00Z'),
                  ...overrides,
                },
              });
            const overdue = await makeTask('overdue', {
              dueDate: new Date('2026-10-31T00:00:00Z'),
            });
            const today = await makeTask('today second admin', {
              assigneeUserId: users[2].id,
              status: 'IN_PROGRESS',
            });
            const tied = await makeTask('same date id tie-break');
            const subtask = await makeTask('eligible subtask', {
              parentId: overdue.id,
              assigneeUserId: users[0].id,
            });
            await tx.taskOwner.createMany({
              data: [users[0], users[2]].map((user) => ({
                taskId: tied.id,
                userId: user.id,
              })),
            });
            await makeTask('member excluded', { assigneeUserId: users[3].id });
            await makeTask('unassigned name must not match', {
              assigneeUserId: null,
              assignee: 'Same name',
            });
            await makeTask('foreign assignee excluded', {
              assigneeUserId: users[4].id,
            });
            await makeTask('undated excluded', { dueDate: null });
            await makeTask('future excluded', {
              dueDate: new Date('2026-11-02T00:00:00Z'),
            });
            await makeTask('done excluded', { status: 'DONE' });
            await makeTask('cancelled excluded', { status: 'CANCELLED' });
            await makeTask('non-sales excluded', { isSales: false });
            await makeTask('other org excluded', {
              organizationId: otherOrg.id,
            });

            const module = await Test.createTestingModule({
              imports: [SalesOverviewModule],
            })
              .overrideProvider(PrismaService)
              .useValue(tx)
              .overrideGuard(AuthGuard)
              .useValue({
                canActivate(context: ExecutionContext) {
                  const req = context.switchToHttp().getRequest();
                  const id = req.headers['x-test-user'];
                  if (!id) return false;
                  req.user = { id, role: 'admin' };
                  req.session = {
                    user: req.user,
                    session: { activeOrganizationId: String(org.id) },
                  };
                  return true;
                },
              })
              .compile();
            app = module.createNestApplication();
            await app.listen(0, '127.0.0.1');
            const base = await app.getUrl();
            const get = (
              query = 'date=2026-11-01',
              userId = users[0].id,
              organizationId = org.id,
            ) =>
              fetch(`${base}/sales-overview/needs-attention?${query}`, {
                headers: {
                  'x-test-user': String(userId),
                  'x-organization-id': String(organizationId),
                },
              });
            const rows = async (query?: string, userId?: number) => {
              const response = await get(query, userId);
              expect(response.status).toBe(200);
              expect(response.headers.get('cache-control')).toContain(
                'no-store',
              );
              return response.json();
            };
            const before = await tx.task.findMany({
              where: { organizationId: org.id },
              orderBy: { id: 'asc' },
            });
            const expected = [overdue.id, today.id, tied.id, subtask.id];
            const all = await rows();
            expect(all.tasks.map((t: { id: number }) => t.id)).toEqual(
              expected,
            );
            expect(all.pagination.total).toBe(4);
            expect(
              all.tasks.map((t: { dueDate: string }) => t.dueDate),
            ).toEqual(['2026-10-31', '2026-11-01', '2026-11-01', '2026-11-01']);
            expect(all.tasks[1].assigneeUser.id).toBe(users[2].id);
            expect((await rows(undefined, users[2].id)).tasks).toEqual(
              all.tasks,
            );
            expect(
              (await rows('date=2026-11-01&page=1&limit=2')).tasks.map(
                (t: { id: number }) => t.id,
              ),
            ).toEqual(expected.slice(0, 2));
            expect(
              (await rows('date=2026-11-01&page=2&limit=2')).tasks.map(
                (t: { id: number }) => t.id,
              ),
            ).toEqual(expected.slice(2));
            expect(
              (await rows('date=2026-11-01&page=3&limit=2')).tasks,
            ).toEqual([]);
            expect(
              (await rows('date=2026-10-31')).tasks.map(
                (t: { id: number }) => t.id,
              ),
            ).toEqual([overdue.id]);
            expect((await rows('date=2026-10-30')).pagination.total).toBe(0);
            expect(
              await tx.task.findMany({
                where: { organizationId: org.id },
                orderBy: { id: 'asc' },
              }),
            ).toEqual(before);
            expect((await get(undefined, users[3].id)).status).toBe(403);
            expect(
              (await get(undefined, users[0].id, otherOrg.id)).status,
            ).toBe(403);
            // Downgrade every duplicate membership for that stable identity.
            await tx.member.updateMany({
              where: { organizationId: org.id, userId: users[1].id },
              data: { role: 'member' },
            });
            expect(
              (await rows()).tasks.map((t: { id: number }) => t.id),
            ).toEqual([today.id, subtask.id]);
            await tx.member.deleteMany({
              where: { organizationId: org.id, userId: users[2].id },
            });
            expect(
              (await rows()).tasks.map((t: { id: number }) => t.id),
            ).toEqual([subtask.id]);
            await tx.member.updateMany({
              where: { organizationId: org.id, userId: users[0].id },
              data: { role: 'member' },
            });
            expect((await get()).status).toBe(403);
            await app.close();
            app = undefined;
            throw rollback;
          },
          { timeout: 30000 },
        );
      } catch (error) {
        if (error !== rollback) throw error;
        expect(
          await prisma.organization.count({
            where: {
              slug: { in: [`7370-${suffix}`, `7370-foreign-${suffix}`] },
            },
          }),
        ).toBe(0);
        expect(
          await prisma.user.count({
            where: { email: { startsWith: `7370-${suffix}-` } },
          }),
        ).toBe(0);
      } finally {
        await app?.close();
        await prisma.$disconnect();
      }
    }, 40000);
  },
);
