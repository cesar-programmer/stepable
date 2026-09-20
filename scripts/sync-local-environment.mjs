import { writeFileSync } from "node:fs";

import { readLocalSupabaseStatus } from "./local-supabase-status.mjs";

const status = readLocalSupabaseStatus();
const content = [
  "# Generated from the running local Supabase stack. Do not commit.",
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
  `DATABASE_URL=${status.DB_URL}`,
  `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
  "STEPABLE_APP_URL=http://127.0.0.1:3000",
  `STEPABLE_MAILPIT_URL=${status.MAILPIT_URL}`,
  "",
].join("\n");

writeFileSync(".env.local", content, { mode: 0o600 });
console.log(".env.local sincronizado con la pila local iniciada.");
