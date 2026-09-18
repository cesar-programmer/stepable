import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  membershipStatuses,
  spaceRoles,
} from "../../modules/access/contract.ts";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});

export const spaceRole = pgEnum("space_role", spaceRoles);
export const membershipStatus = pgEnum("membership_status", membershipStatuses);

export const profiles = pgTable("profiles", {
  identityId: uuid("identity_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    initialResponsibleId: uuid("initial_responsible_id")
      .notNull()
      .references(() => profiles.identityId, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("spaces_slug_key").on(table.slug),
    check(
      "spaces_slug_format",
      sql`char_length(${table.slug}) between 3 and 63 and ${table.slug} = lower(${table.slug}) and ${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "spaces_name_format",
      sql`char_length(${table.name}) between 1 and 120 and ${table.name} = btrim(${table.name})`,
    ),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.identityId, { onDelete: "restrict" }),
    role: spaceRole("role").notNull(),
    status: membershipStatus("status").notNull().default("activa"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.spaceId, table.profileId] }),
    index("memberships_profile_id_idx").on(table.profileId),
  ],
);
