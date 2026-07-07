/**
 * One-shot registration: registers a host + autonomous agent against the Zuko
 * backend and prints the credentials to provision as env vars in production.
 *
 *   bun run register   (or: node --experimental-strip-types scripts/register.ts)
 */
import { register } from '../agent/lib/zuko-client';

const creds = await register();

console.log("\nProvision these in your deployment's secret store:\n");
console.log(`ZUKO_AGENT_ID=${creds.agentId}`);
console.log(`ZUKO_AGENT_PRIVATE_JWK=${JSON.stringify(creds.agentPrivateJwk)}`);
console.log(`ZUKO_AGENT_PUBLIC_JWK=${JSON.stringify(creds.agentPublicJwk)}`);
