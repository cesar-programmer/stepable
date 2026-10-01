import { getApplicationSourceQueue } from "@/adapters/pg-boss/source-queue";
import { PostgresAccessRepository } from "@/adapters/postgres/access-repository";
import { getApplicationDatabase } from "@/adapters/postgres/database";
import { PostgresSourceRepository } from "@/adapters/postgres/source-repository";
import { SupabaseSourceStorage } from "@/adapters/supabase/source-storage";
import { getServerEnvironment } from "@/lib/env";

export function sourceReadDependencies() {
  const database = getApplicationDatabase();
  return {
    accessRepository: new PostgresAccessRepository(database),
    sourceRepository: new PostgresSourceRepository(database, null),
  };
}

export async function sourceUploadDependencies() {
  const environment = getServerEnvironment();
  const database = getApplicationDatabase();
  return {
    accessRepository: new PostgresAccessRepository(database),
    sourceRepository: new PostgresSourceRepository(
      database,
      await getApplicationSourceQueue(environment.DATABASE_URL),
    ),
    storage: new SupabaseSourceStorage(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
