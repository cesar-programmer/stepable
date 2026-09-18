import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function parseEnvironmentFile(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function readGeneratedLocalStatus() {
  const secretsPath =
    "supabase/.temp/start-secrets/supabase_edge_runtime_stepable/env/docker.env";
  if (!existsSync(secretsPath)) {
    return null;
  }

  const secrets = parseEnvironmentFile(secretsPath);
  const config = readFileSync("supabase/config.toml", "utf8");
  const apiPort = config.match(/\[api\][\s\S]*?\nport = (\d+)/)?.[1];
  const mailpitPort = config.match(/\[local_smtp\][\s\S]*?\nport = (\d+)/)?.[1];
  if (!apiPort || !mailpitPort) {
    return null;
  }

  return {
    API_URL: `http://127.0.0.1:${apiPort}`,
    PUBLISHABLE_KEY:
      secrets.SUPABASE_INTERNAL_PUBLISHABLE_KEY ?? secrets.SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY: secrets.SUPABASE_SERVICE_ROLE_KEY,
    MAILPIT_URL: `http://127.0.0.1:${mailpitPort}`,
  };
}

export function readLocalSupabaseStatus() {
  const result = spawnSync(
    "./node_modules/.bin/supabase",
    ["status", "-o", "json"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  const status =
    result.status === 0
      ? JSON.parse(result.stdout)
      : readGeneratedLocalStatus();
  if (!status) {
    throw new Error(
      "Supabase local no está disponible. Ejecuta `pnpm env:start`.",
    );
  }
  const required = [
    "API_URL",
    "PUBLISHABLE_KEY",
    "SERVICE_ROLE_KEY",
    "MAILPIT_URL",
  ];
  for (const key of required) {
    if (typeof status[key] !== "string" || status[key].length === 0) {
      throw new Error(`Supabase local no proporcionó ${key}.`);
    }
  }

  return status;
}
