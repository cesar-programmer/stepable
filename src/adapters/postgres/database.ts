import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getLocalEnvironment } from "../../lib/env.ts";

import * as schema from "./schema.ts";

export function createPostgresDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10,
    prepare: false,
  });

  return {
    client,
    connectionString,
    database: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export type StepableDatabase = ReturnType<
  typeof createPostgresDatabase
>["database"];

const globalDatabase = globalThis as typeof globalThis & {
  stepableDatabase?: ReturnType<typeof createPostgresDatabase>;
};

export function getApplicationDatabase(): StepableDatabase {
  const connectionString = getLocalEnvironment().DATABASE_URL;
  if (
    globalDatabase.stepableDatabase &&
    globalDatabase.stepableDatabase.connectionString !== connectionString
  ) {
    void globalDatabase.stepableDatabase.close();
    globalDatabase.stepableDatabase = undefined;
  }

  if (!globalDatabase.stepableDatabase) {
    globalDatabase.stepableDatabase = createPostgresDatabase(connectionString);
  }

  return globalDatabase.stepableDatabase.database;
}
