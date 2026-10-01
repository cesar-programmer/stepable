import process from "node:process";

import { getWorkerEnvironment } from "../lib/env.ts";

import { startSourceWorker } from "./source-worker.ts";

const environment = getWorkerEnvironment();
const worker = await startSourceWorker({
  databaseUrl: environment.DATABASE_URL,
  supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await worker.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
