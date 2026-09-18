import { and, asc, eq, sql } from "drizzle-orm";

import type {
  AccessRepository,
  BootstrapSpaceInput,
  BootstrapSpaceResult,
  UserSpace,
} from "../../modules/access/contract.ts";
import {
  IdentityNotFoundError,
  SpaceBootstrapConflictError,
} from "../../modules/access/contract.ts";

import type { StepableDatabase } from "./database.ts";
import { authUsers, memberships, profiles, spaces } from "./schema.ts";

export class PostgresAccessRepository implements AccessRepository {
  private readonly database: StepableDatabase;

  constructor(database: StepableDatabase) {
    this.database = database;
  }

  async bootstrapSpace(
    input: BootstrapSpaceInput,
  ): Promise<BootstrapSpaceResult> {
    return this.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${input.slug}, 0))`,
      );

      const identities = await transaction
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(sql`lower(${authUsers.email}) = ${input.email}`)
        .limit(2);

      if (identities.length !== 1) {
        throw new IdentityNotFoundError();
      }

      const identityId = identities[0].id;
      await transaction
        .insert(profiles)
        .values({ identityId })
        .onConflictDoNothing();

      const [existingSpace] = await transaction
        .select({
          id: spaces.id,
          slug: spaces.slug,
          name: spaces.name,
          initialResponsibleId: spaces.initialResponsibleId,
        })
        .from(spaces)
        .where(eq(spaces.slug, input.slug))
        .limit(1);

      if (existingSpace) {
        const [existingMembership] = await transaction
          .select({ role: memberships.role })
          .from(memberships)
          .where(
            and(
              eq(memberships.spaceId, existingSpace.id),
              eq(memberships.profileId, identityId),
            ),
          )
          .limit(1);

        if (
          existingSpace.name !== input.name ||
          existingSpace.initialResponsibleId !== identityId ||
          existingMembership?.role !== "responsable"
        ) {
          throw new SpaceBootstrapConflictError();
        }

        return {
          created: false,
          space: {
            id: existingSpace.id,
            slug: existingSpace.slug,
            name: existingSpace.name,
            role: existingMembership.role,
          },
        };
      }

      const [createdSpace] = await transaction
        .insert(spaces)
        .values({
          slug: input.slug,
          name: input.name,
          initialResponsibleId: identityId,
        })
        .returning({ id: spaces.id, slug: spaces.slug, name: spaces.name });

      await transaction.insert(memberships).values({
        spaceId: createdSpace.id,
        profileId: identityId,
        role: "responsable",
      });

      return {
        created: true,
        space: { ...createdSpace, role: "responsable" },
      };
    });
  }

  async listSpacesForIdentity(identityId: string): Promise<UserSpace[]> {
    return this.database
      .select({
        id: spaces.id,
        slug: spaces.slug,
        name: spaces.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(spaces, eq(spaces.id, memberships.spaceId))
      .where(eq(memberships.profileId, identityId))
      .orderBy(asc(spaces.name), asc(spaces.id));
  }

  async findSpaceForIdentity(
    identityId: string,
    spaceId: string,
  ): Promise<UserSpace | null> {
    const [space] = await this.database
      .select({
        id: spaces.id,
        slug: spaces.slug,
        name: spaces.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(spaces, eq(spaces.id, memberships.spaceId))
      .where(
        and(
          eq(memberships.profileId, identityId),
          eq(memberships.spaceId, spaceId),
        ),
      )
      .limit(1);

    return space ?? null;
  }
}
