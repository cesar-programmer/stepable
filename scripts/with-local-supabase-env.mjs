import { spawn } from "node:child_process";

import { readLocalSupabaseStatus } from "./local-supabase-status.mjs";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error("Falta el comando que debe ejecutarse con el entorno local.");
}

const status = readLocalSupabaseStatus();
const child = spawn(command, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    STEPABLE_TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    STEPABLE_TEST_MAILPIT_URL: status.MAILPIT_URL,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
