import { waitForPortOpen } from "@nx/node/utils";
import { spawn } from "child_process";
import { killPort } from "@nx/node/utils";

let serverProcess: ReturnType<typeof spawn> | undefined;

export async function setup() {
  console.log("\nSetting up...\n");

  const host = process.env.HOST ?? "localhost";
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  console.log(`Starting backend server on port ${port}...`);
  serverProcess = spawn("npx", ["nx", "serve", "backend"], {
    env: { ...process.env, PORT: port.toString() },
    detached: false,
    stdio: "ignore",
  });

  await waitForPortOpen(port, { host, retries: 60, retryDelay: 1000 });
  console.log(`Backend server is ready on port ${port}`);
}

export async function teardown() {
  console.log("\nTearing down...\n");
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await killPort(port);
}
