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
    DATABASE_URL: status.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    STEPABLE_APP_URL: "http://127.0.0.1:3000",
    STEPABLE_MAILPIT_URL: status.MAILPIT_URL,
    STEPABLE_TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    STEPABLE_TEST_MAILPIT_URL: status.MAILPIT_URL,
    // Test commands never reach a paid AI provider, whatever .env files say.
    STEPABLE_AI_CHAT_MODE: "simulado",
    STEPABLE_AI_EMBEDDINGS_MODE: "simulado",
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
