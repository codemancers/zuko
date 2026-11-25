import {
  FatalError,
  RetryableError,
  getStepMetadata,
  getWorkflowMetadata,
  getWritable,
} from 'workflow';
import { getRun } from 'workflow/api';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { runInTenant, type TenantTransaction } from '../prisma/tenant-transaction';
import {
  provisionStandardObjects,
  StandardObjectConflict,
} from '../crm/provision-standard-objects';

// Steps execute outside Nest's DI container; reuse one pool for their lifetime.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC' }),
});
const tenant = <T>(organizationId: bigint, work: (tx: TenantTransaction) => Promise<T>) =>
  runInTenant(prisma, { organizationId }, work);

type SetupStep = 'prepare' | 'crm' | 'finish';

async function progress(status: 'running' | 'ready' | 'failed', message: string, step: SetupStep) {
  const writer = getWritable<Uint8Array>().getWriter();
  try {
    await writer.write(
      new TextEncoder().encode(`data: ${JSON.stringify({ status, message, step })}\n\n`),
    );
  } finally {
    writer.releaseLock();
  }
}

export async function markRunning(organizationId: string) {
  'use step';
  const id = BigInt(organizationId);
  const { workflowRunId: runId } = getWorkflowMetadata();
  await tenant(id, async (tx) => {
    const [setup] = await tx.$queryRaw<{ runId: string | null }[]>`
      SELECT "runId" FROM organization_setup WHERE "organizationId" = ${id} FOR UPDATE`;
    if (!setup) throw new FatalError('Organization no longer exists');
    const replacing = setup.runId !== null && setup.runId !== runId;
    if (
      replacing &&
      !['completed', 'failed', 'cancelled'].includes(await getRun(setup.runId!).status)
    ) {
      throw new FatalError('Another setup run is already active for this organization');
    }
    await tx.organizationSetup.update({
      where: { organizationId: id },
      data: {
        status: 'running',
        runId,
        error: null,
        ...(replacing ? { attempt: { increment: 1 } } : {}),
      },
    });
  });
  // A dashboard rerun has a new ID; subsequent frontend connections must follow it.
  await prisma.organization.update({ where: { id }, data: { setupRunId: runId } });
  await progress('running', 'Preparing your organization…', 'prepare');
}

export async function provisionCrm(organizationId: string) {
  'use step';
  const id = BigInt(organizationId);
  const { workflowRunId } = getWorkflowMetadata();
  await progress('running', 'Creating contacts, companies, deals, and their relationships…', 'crm');
  try {
    await tenant(id, async (tx) => {
      const [setup] = await tx.$queryRaw<{ runId: string | null; status: string }[]>`
        SELECT "runId", status FROM organization_setup WHERE "organizationId" = ${id} FOR UPDATE`;
      if (!setup || setup.runId !== workflowRunId || setup.status !== 'running') {
        throw new FatalError('This workflow no longer owns organization setup');
      }
      await provisionStandardObjects(tx, id);
    });
  } catch (error) {
    if (error instanceof StandardObjectConflict) throw new FatalError(error.message);
    if (FatalError.is(error)) throw error;
    console.error('CRM provisioning failed', { organizationId, error });
    throw new RetryableError('CRM setup could not finish', {
      retryAfter: Math.min(1000 * 2 ** getStepMetadata().attempt, 30000),
    });
  }
}
provisionCrm.maxRetries = 5;

export async function markReady(organizationId: string) {
  'use step';
  await progress('running', 'Finishing setup…', 'finish');
  await tenant(BigInt(organizationId), (tx) =>
    tx.organizationSetup.updateMany({
      where: {
        organizationId: BigInt(organizationId),
        runId: getWorkflowMetadata().workflowRunId,
        status: 'running',
      },
      data: { status: 'ready', error: null },
    }),
  );
  await progress('ready', 'Your organization is ready.', 'finish');
}

export async function markFailed(organizationId: string, message: string, step: SetupStep) {
  'use step';
  await tenant(BigInt(organizationId), (tx) =>
    tx.organizationSetup.updateMany({
      where: {
        organizationId: BigInt(organizationId),
        runId: getWorkflowMetadata().workflowRunId,
        status: 'running',
      },
      data: { status: 'failed', error: message },
    }),
  );
  await progress('failed', message, step);
}

export async function closeProgress() {
  'use step';
  await getWritable().close();
}
