import process from "node:process";
import { createInterface } from "node:readline/promises";

import { PostgresAccessRepository } from "../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../src/adapters/postgres/database.ts";
import {
  IdentityNotFoundError,
  SpaceBootstrapConflictError,
} from "../src/modules/access/contract.ts";
import { bootstrapSpace } from "../src/modules/access/bootstrap-space.ts";
import { readLocalSupabaseStatus } from "./local-supabase-status.mjs";

const reader = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const email = await reader.question("Correo de la identidad local existente: ");
const slug = await reader.question("Clave estable del espacio (slug): ");
const name = await reader.question("Nombre visible del espacio: ");
reader.close();

const connection = createPostgresDatabase(readLocalSupabaseStatus().DB_URL);

try {
  const result = await bootstrapSpace(
    new PostgresAccessRepository(connection.database),
    { email, slug, name },
  );
  console.log(
    result.created
      ? `Espacio creado y responsable asignado: ${result.space.name} (${result.space.slug}).`
      : `El espacio ya estaba aprovisionado con los mismos datos: ${result.space.name} (${result.space.slug}).`,
  );
} catch (error) {
  if (
    error instanceof IdentityNotFoundError ||
    error instanceof SpaceBootstrapConflictError
  ) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await connection.close();
}
