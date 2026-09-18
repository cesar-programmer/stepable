import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAccessRepository } from "../../src/adapters/postgres/access-repository.ts";
import { createPostgresDatabase } from "../../src/adapters/postgres/database.ts";
import {
  authorizeSpaceAction,
  listAuthorizedSpaces,
} from "../../src/modules/access/authorization.ts";
import {
  IdentityNotFoundError,
  SpaceBootstrapConflictError,
} from "../../src/modules/access/contract.ts";
import { bootstrapSpace } from "../../src/modules/access/bootstrap-space.ts";
import {
  createAdminClient,
  createLocalTestIdentity,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
} from "../support/local-auth";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
const connection = createPostgresDatabase(config.databaseUrl);
const repository = new PostgresAccessRepository(connection.database);
const runKey = `e1-4-${randomUUID()}`;
const identities: LocalTestIdentity[] = [];

function spaceInput(suffix: string, identity: LocalTestIdentity) {
  return {
    email: identity.email,
    slug: `${runKey}-${suffix}`,
    name: `E1.4 ${suffix}`,
  };
}

async function ensureProfile(identity: LocalTestIdentity) {
  await connection.client`
    insert into public.profiles (identity_id)
    values (${identity.id})
    on conflict (identity_id) do nothing
  `;
}

describe("access persistence and authorization", () => {
  beforeAll(async () => {
    identities.push(
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
      await createLocalTestIdentity(admin),
    );
  });

  afterAll(async () => {
    await connection.client`
      delete from public.spaces
      where slug like ${`${runKey}%`}
    `;
    for (const identity of identities) {
      await connection.client`
        delete from public.profiles where identity_id = ${identity.id}
      `;
      await deleteLocalTestIdentity(admin, identity.id);
    }
    await connection.close();
  });

  it("links the Auth identity and creates the space with its first responsible atomically", async () => {
    const input = spaceInput("atomic", identities[0]);
    const result = await bootstrapSpace(repository, input);

    expect(result.created).toBe(true);
    expect(result.space).toMatchObject({
      slug: input.slug,
      name: input.name,
      role: "responsable",
    });

    const rows = await connection.client`
      select
        p.identity_id,
        s.initial_responsible_id,
        m.role::text as role,
        m.status::text as status
      from public.spaces s
      join public.memberships m on m.space_id = s.id
      join public.profiles p on p.identity_id = m.profile_id
      where s.slug = ${input.slug}
    `;
    expect(rows).toEqual([
      {
        identity_id: identities[0].id,
        initial_responsible_id: identities[0].id,
        role: "responsable",
        status: "activa",
      },
    ]);

    await expect(
      connection.client`
        insert into public.spaces (slug, name, initial_responsible_id)
        values (${`${runKey}-orphan`}, 'Orphan', ${identities[0].id})
      `,
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("is idempotent under repetition and concurrent execution", async () => {
    const input = spaceInput("concurrent", identities[0]);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => bootstrapSpace(repository, input)),
    );

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.space.id)).size).toBe(1);

    const [counts] = await connection.client`
      select
        count(distinct s.id)::int as spaces,
        count(m.*)::int as memberships
      from public.spaces s
      left join public.memberships m on m.space_id = s.id
      where s.slug = ${input.slug}
    `;
    expect(counts).toEqual({ spaces: 1, memberships: 1 });
  });

  it("rejects missing identities and incompatible repetitions without partial data", async () => {
    const missingSlug = `${runKey}-missing`;
    await expect(
      bootstrapSpace(repository, {
        email: `missing-${randomUUID()}@example.test`,
        slug: missingSlug,
        name: "Missing identity",
      }),
    ).rejects.toBeInstanceOf(IdentityNotFoundError);

    const input = spaceInput("conflict", identities[0]);
    await bootstrapSpace(repository, input);
    await expect(
      bootstrapSpace(repository, { ...input, name: "Different name" }),
    ).rejects.toBeInstanceOf(SpaceBootstrapConflictError);
    await expect(
      bootstrapSpace(repository, { ...input, email: identities[1].email }),
    ).rejects.toBeInstanceOf(SpaceBootstrapConflictError);

    const rows = await connection.client`
      select s.slug, count(m.*)::int as memberships
      from public.spaces s
      left join public.memberships m on m.space_id = s.id
      where s.slug in (${missingSlug}, ${input.slug})
      group by s.slug
      order by s.slug
    `;
    expect(rows).toEqual([{ slug: input.slug, memberships: 1 }]);
  });

  it("enforces membership uniqueness, valid roles and referential integrity", async () => {
    const input = spaceInput("constraints", identities[0]);
    const { space } = await bootstrapSpace(repository, input);

    await expect(
      connection.client`
        insert into public.memberships (space_id, profile_id, role)
        values (${space.id}, ${identities[0].id}, 'responsable')
      `,
    ).rejects.toMatchObject({ code: "23505" });

    await expect(
      connection.client`
        insert into public.memberships (space_id, profile_id, role)
        values (${space.id}, ${identities[0].id}, ${"administrador"})
      `,
    ).rejects.toMatchObject({ code: "22P02" });

    await expect(
      connection.client`
        insert into public.memberships (space_id, profile_id, role)
        values (${space.id}, ${randomUUID()}, 'integrante')
      `,
    ).rejects.toMatchObject({ code: "23503" });

    await expect(
      connection.client`
        update public.memberships
        set role = 'integrante'
        where space_id = ${space.id} and profile_id = ${identities[0].id}
      `,
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("lists and finds only spaces allowed by current membership", async () => {
    const own = await bootstrapSpace(
      repository,
      spaceInput("owned", identities[0]),
    );
    const foreign = await bootstrapSpace(
      repository,
      spaceInput("foreign", identities[1]),
    );

    const firstSpaces = await listAuthorizedSpaces(
      repository,
      identities[0].id,
    );
    expect(firstSpaces.some((space) => space.id === own.space.id)).toBe(true);
    expect(firstSpaces.some((space) => space.id === foreign.space.id)).toBe(
      false,
    );
    expect(
      await authorizeSpaceAction(
        repository,
        identities[0].id,
        foreign.space.id,
        "consultar_espacio",
      ),
    ).toBeNull();
    expect(await listAuthorizedSpaces(repository, identities[2].id)).toEqual(
      [],
    );
  });

  it("denies missing and revoked memberships without affecting other spaces", async () => {
    const revoked = await bootstrapSpace(
      repository,
      spaceInput("revoked", identities[0]),
    );
    const retained = await bootstrapSpace(
      repository,
      spaceInput("retained", identities[0]),
    );
    await ensureProfile(identities[1]);
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values
        (${revoked.space.id}, ${identities[1].id}, 'integrante'),
        (${retained.space.id}, ${identities[1].id}, 'integrante')
    `;

    expect(
      await authorizeSpaceAction(
        repository,
        identities[1].id,
        revoked.space.id,
        "consultar_espacio",
      ),
    ).not.toBeNull();
    expect(
      await authorizeSpaceAction(
        repository,
        identities[2].id,
        revoked.space.id,
        "consultar_espacio",
      ),
    ).toBeNull();

    await connection.client`
      update public.memberships
      set status = 'revocada'
      where space_id = ${revoked.space.id}
        and profile_id = ${identities[1].id}
    `;

    expect(
      await authorizeSpaceAction(
        repository,
        identities[1].id,
        revoked.space.id,
        "consultar_espacio",
      ),
    ).toBeNull();
    expect(
      await authorizeSpaceAction(
        repository,
        identities[1].id,
        retained.space.id,
        "consultar_espacio",
      ),
    ).not.toBeNull();
    const visibleSpaceIds = (
      await listAuthorizedSpaces(repository, identities[1].id)
    ).map((space) => space.id);
    expect(visibleSpaceIds).toContain(retained.space.id);
    expect(visibleSpaceIds).not.toContain(revoked.space.id);
  });

  it("uses the current role for every authorization decision", async () => {
    const { space } = await bootstrapSpace(
      repository,
      spaceInput("role-change", identities[0]),
    );
    await ensureProfile(identities[1]);
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${space.id}, ${identities[1].id}, 'integrante')
    `;

    expect(
      await authorizeSpaceAction(
        repository,
        identities[1].id,
        space.id,
        "gestionar_miembros",
      ),
    ).toBeNull();

    await connection.client`
      update public.memberships
      set role = 'responsable'
      where space_id = ${space.id}
        and profile_id = ${identities[1].id}
    `;

    expect(
      await authorizeSpaceAction(
        repository,
        identities[1].id,
        space.id,
        "gestionar_miembros",
      ),
    ).toMatchObject({ id: space.id, role: "responsable" });
    expect(
      await authorizeSpaceAction(
        repository,
        identities[1].id,
        space.id,
        "accion_desconocida",
      ),
    ).toBeNull();
  });

  it("counts only active responsibles and preserves a revoked bootstrap conflict", async () => {
    const input = spaceInput("active-responsible", identities[0]);
    const { space } = await bootstrapSpace(repository, input);
    await ensureProfile(identities[1]);
    await connection.client`
      insert into public.memberships (space_id, profile_id, role)
      values (${space.id}, ${identities[1].id}, 'responsable')
    `;

    await connection.client`
      update public.memberships
      set status = 'revocada'
      where space_id = ${space.id}
        and profile_id = ${identities[0].id}
    `;

    await expect(bootstrapSpace(repository, input)).rejects.toBeInstanceOf(
      SpaceBootstrapConflictError,
    );
    await expect(
      connection.client`
        update public.memberships
        set status = 'revocada'
        where space_id = ${space.id}
          and profile_id = ${identities[1].id}
      `,
    ).rejects.toMatchObject({ code: "23514" });

    const [initialMembership] = await connection.client`
      select role::text as role, status::text as status
      from public.memberships
      where space_id = ${space.id}
        and profile_id = ${identities[0].id}
    `;
    expect(initialMembership).toEqual({
      role: "responsable",
      status: "revocada",
    });
  });
});
