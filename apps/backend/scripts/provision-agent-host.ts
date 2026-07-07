/**
 * Provision an AgentHost for an external agent harness (e.g. apps/ai-agent).
 *
 * The agent-auth plugin's dynamic host registration expects string host ids,
 * but our schema uses serial Ints — so external agents cannot self-register a
 * host. This script pre-creates the host row (mirroring
 * AgentAuthBridgeService.ensureGlobalPoolHost) and prints the credentials the
 * external harness needs to register its agents using the numeric-issuer path.
 *
 * Run from apps/backend (reads DATABASE_URL and BETTER_AUTH_SECRET from env):
 *   bun run provision:agent-host [host-name]
 */
import { PrismaClient } from '@zuko/models';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateKeypair } from '@auth/agent';
import { symmetricEncrypt } from 'better-auth/crypto';

const HOST_NAME = process.argv[2] ?? 'zuko-eve-host';

const AGENT_CAPABILITIES = [
  'list_tasks',
  'get_task',
  'create_task',
  'update_task',
  'delete_task',
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error('BETTER_AUTH_SECRET is required');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const existing = await prisma.agentHost.findFirst({
  where: { name: HOST_NAME, userId: null, status: 'active' },
  select: { id: true },
});
if (existing) {
  console.error(
    `Host "${HOST_NAME}" already exists (id=${existing.id}). Its private key was only printed at creation; pass a new host name to provision a fresh one.`,
  );
  process.exit(1);
}

const keypair = await generateKeypair();
const encryptedPrivJwk = await symmetricEncrypt({
  key: secret,
  data: JSON.stringify(keypair.privateKey),
});

const host = await prisma.$transaction(async (tx) => {
  const created = await tx.agentHost.create({
    data: {
      userId: null,
      name: HOST_NAME,
      publicKey: JSON.stringify(keypair.publicKey),
      kid: keypair.publicKey.kid ?? null,
      defaultCapabilities: JSON.stringify(AGENT_CAPABILITIES),
      status: 'active',
      activatedAt: new Date(),
    },
    select: { id: true },
  });
  await tx.hostSigningKey.create({
    data: {
      agentHostId: created.id,
      privateJwkEncrypted: encryptedPrivJwk,
    },
  });
  return created;
});

console.log(`Provisioned agent host "${HOST_NAME}" (id=${host.id}).`);
console.log('\nConfigure the external agent harness with:\n');
console.log(`ZUKO_HOST_ID=${host.id}`);
console.log(`ZUKO_HOST_PRIVATE_JWK=${JSON.stringify(keypair.privateKey)}`);

await prisma.$disconnect();
