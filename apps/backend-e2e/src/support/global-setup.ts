import { waitForPortOpen } from "@nx/node/utils";
import { spawn } from "child_process";

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log("\nSetting up...\n");

  const host = process.env.HOST ?? "localhost";
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Start the backend server
  console.log(`Starting backend server on port ${port}...`);
  const serverProcess = spawn("npx", ["nx", "serve", "backend"], {
    env: { ...process.env, PORT: port.toString() },
    detached: false,
    stdio: "ignore",
  });

  // Wait for the server to be ready
  await waitForPortOpen(port, { host, retries: 60, retryDelay: 1000 });
  console.log(`Backend server is ready on port ${port}`);

  // Store the server process for cleanup in teardown
  globalThis.__SERVER_PROCESS__ = serverProcess;
  globalThis.__TEARDOWN_MESSAGE__ = "\nTearing down...\n";
};
