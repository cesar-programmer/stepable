import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  unique,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  invitationDeliveryStatuses,
  invitationStatuses,
} from "../../modules/invitations/contract.ts";

import {
  accessAuditActions,
  accessAuditActorTypes,
  accessAuditTargetTypes,
} from "../../modules/access/audit.ts";

import {
  membershipStatuses,
  spaceRoles,
} from "../../modules/access/contract.ts";

import {
  sourceFormats,
  sourceStatuses,
  sourceVersionStatuses,
} from "../../modules/sources/contract.ts";

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});

export const spaceRole = pgEnum("space_role", spaceRoles);
export const membershipStatus = pgEnum("membership_status", membershipStatuses);
export const invitationStatus = pgEnum("invitation_status", invitationStatuses);
export const invitationDeliveryStatus = pgEnum(
  "invitation_delivery_status",
  invitationDeliveryStatuses,
);
export const accessAuditAction = pgEnum(
  "access_audit_action",
  accessAuditActions,
);
export const accessAuditActorType = pgEnum(
  "access_audit_actor_type",
  accessAuditActorTypes,
);
export const accessAuditTargetType = pgEnum(
  "access_audit_target_type",
  accessAuditTargetTypes,
);

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

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: spaceRole("role").notNull().default("integrante"),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => profiles.identityId, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatus("status").notNull().default("pendiente"),
    deliveryStatus: invitationDeliveryStatus("delivery_status")
      .notNull()
      .default("pendiente"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => profiles.identityId, {
      onDelete: "restrict",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_key").on(table.tokenHash),
    uniqueIndex("invitations_one_pending_email_per_space_idx")
      .on(table.spaceId, table.email)
      .where(sql`${table.status} = 'pendiente'`),
    index("invitations_space_created_at_idx").on(
      table.spaceId,
      table.createdAt,
    ),
    check(
      "invitations_email_format",
      sql`char_length(${table.email}) between 3 and 320 and ${table.email} = lower(${table.email}) and ${table.email} = btrim(${table.email}) and position('@' in ${table.email}) > 1`,
    ),
    check(
      "invitations_token_hash_format",
      sql`char_length(${table.tokenHash}) = 64 and ${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const accessAuditEvents = pgTable(
  "access_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: accessAuditAction("action").notNull(),
    actorType: accessAuditActorType("actor_type").notNull(),
    actorProfileId: uuid("actor_profile_id").references(
      () => profiles.identityId,
      { onDelete: "restrict" },
    ),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    targetType: accessAuditTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("access_audit_events_space_occurred_at_idx").on(
      table.spaceId,
      table.occurredAt,
    ),
    index("access_audit_events_actor_occurred_at_idx")
      .on(table.actorProfileId, table.occurredAt)
      .where(sql`${table.actorProfileId} is not null`),
    check(
      "access_audit_actor_fields",
      sql`(${table.actorType} = 'identidad' and ${table.actorProfileId} is not null) or (${table.actorType} = 'operador' and ${table.actorProfileId} is null)`,
    ),
  ],
);

export const sourceStatus = pgEnum("source_status", sourceStatuses);
export const sourceFormat = pgEnum("source_format", sourceFormats);
export const sourceVersionStatus = pgEnum(
  "source_version_status",
  sourceVersionStatuses,
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    title: text("title"),
    status: sourceStatus("status").notNull().default("activa"),
    currentVersionId: uuid("current_version_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.identityId, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => profiles.identityId, {
      onDelete: "restrict",
    }),
    purgeRequestedAt: timestamp("purge_requested_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
  },
  (table) => [
    unique("sources_id_space_key").on(table.id, table.spaceId),
    index("sources_space_created_at_idx").on(table.spaceId, table.createdAt),
  ],
);

export const sourceVersions = pgTable(
  "source_versions",
  {
    id: uuid("id").primaryKey(),
    sourceId: uuid("source_id").notNull(),
    spaceId: uuid("space_id").notNull(),
    number: integer("number").notNull(),
    format: sourceFormat("format").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256"),
    storageKey: text("storage_key").notNull(),
    status: sourceVersionStatus("status").notNull().default("en_cola"),
    errorCode: text("error_code"),
    sectionCount: integer("section_count"),
    pageCount: integer("page_count"),
    attempts: integer("attempts").notNull().default(0),
    manualRetries: integer("manual_retries").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.identityId, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "source_versions_source_fkey",
      columns: [table.sourceId, table.spaceId],
      foreignColumns: [sources.id, sources.spaceId],
    }).onDelete("cascade"),
    unique("source_versions_number_key").on(table.sourceId, table.number),
  ],
);

export const sourceSegments = pgTable(
  "source_segments",
  {
    versionId: uuid("version_id")
      .notNull()
      .references(() => sourceVersions.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    headingPath: text("heading_path").array().notNull().default([]),
    startLine: integer("start_line"),
    endLine: integer("end_line"),
    pageNumber: integer("page_number"),
    content: text("content").notNull(),
  },
  (table) => [primaryKey({ columns: [table.versionId, table.ordinal] })],
);
