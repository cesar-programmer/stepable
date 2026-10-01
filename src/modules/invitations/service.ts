import type { AccessRepository, SpaceRole } from "../access/contract.ts";
import { authorizeSpaceAction } from "../access/authorization.ts";

import type {
  AcceptInvitationResult,
  InvitationMailer,
  InvitationPreview,
  InvitationRepository,
  InvitedIdentityGateway,
  SpaceInvitation,
} from "./contract.ts";
import {
  buildInvitationAcceptUrl,
  createInvitationToken,
  hashInvitationToken,
} from "./token.ts";

const invitationLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;

type ManagementDependencies = {
  accessRepository: AccessRepository;
  invitationRepository: InvitationRepository;
};

type DeliveryDependencies = ManagementDependencies & {
  mailer: InvitationMailer;
  applicationUrl: string;
};

type ClockAndToken = {
  now?: Date;
  token?: string;
};

function expirationFrom(now: Date): Date {
  return new Date(now.getTime() + invitationLifetimeMilliseconds);
}

async function canManageInvitations(
  dependencies: ManagementDependencies,
  identityId: string,
  spaceId: string,
): Promise<boolean> {
  return Boolean(
    await authorizeSpaceAction(
      dependencies.accessRepository,
      identityId,
      spaceId,
      "gestionar_invitaciones",
    ),
  );
}

async function deliverPreparedInvitation(
  dependencies: DeliveryDependencies,
  invitation: SpaceInvitation,
  spaceName: string,
  rawToken: string,
  now: Date,
): Promise<"sent" | "failed" | "state_changed"> {
  const tokenHash = hashInvitationToken(rawToken);

  try {
    await dependencies.mailer.sendInvitation({
      recipient: invitation.email,
      spaceName,
      role: invitation.role,
      acceptUrl: buildInvitationAcceptUrl(
        dependencies.applicationUrl,
        rawToken,
      ),
    });
  } catch {
    const recorded = await dependencies.invitationRepository.recordDelivery({
      invitationId: invitation.id,
      tokenHash,
      deliveryStatus: "fallida",
      now,
    });
    return recorded ? "failed" : "state_changed";
  }

  const recorded = await dependencies.invitationRepository.recordDelivery({
    invitationId: invitation.id,
    tokenHash,
    deliveryStatus: "enviada",
    now,
  });
  return recorded ? "sent" : "state_changed";
}

export async function listSpaceInvitations(
  dependencies: ManagementDependencies,
  input: { identityId: string; spaceId: string; now?: Date },
): Promise<SpaceInvitation[] | null> {
  if (
    !(await canManageInvitations(dependencies, input.identityId, input.spaceId))
  ) {
    return null;
  }

  return dependencies.invitationRepository.listInvitations(
    input.spaceId,
    input.now ?? new Date(),
  );
}

export type IssueInvitationResult =
  | "sent"
  | "delivery_failed"
  | "state_changed"
  | "unauthorized"
  | "pending_exists"
  | "already_member"
  | "member_role_conflict";

export async function issueSpaceInvitation(
  dependencies: DeliveryDependencies,
  input: {
    identityId: string;
    spaceId: string;
    email: string;
    role: SpaceRole;
  } & ClockAndToken,
): Promise<IssueInvitationResult> {
  if (
    !(await canManageInvitations(dependencies, input.identityId, input.spaceId))
  ) {
    return "unauthorized";
  }

  const now = input.now ?? new Date();
  const rawToken = input.token ?? createInvitationToken();
  const created = await dependencies.invitationRepository.createInvitation({
    spaceId: input.spaceId,
    email: input.email,
    role: input.role,
    invitedBy: input.identityId,
    tokenHash: hashInvitationToken(rawToken),
    expiresAt: expirationFrom(now),
    now,
  });

  if (created.kind !== "created") {
    return created.kind;
  }

  const delivery = await deliverPreparedInvitation(
    dependencies,
    created.invitation,
    created.spaceName,
    rawToken,
    now,
  );
  return delivery === "failed" ? "delivery_failed" : delivery;
}

export type ResendInvitationResult =
  | "sent"
  | "delivery_failed"
  | "state_changed"
  | "unauthorized"
  | "not_found"
  | "not_resendable";

export async function resendSpaceInvitation(
  dependencies: DeliveryDependencies,
  input: {
    identityId: string;
    spaceId: string;
    invitationId: string;
  } & ClockAndToken,
): Promise<ResendInvitationResult> {
  if (
    !(await canManageInvitations(dependencies, input.identityId, input.spaceId))
  ) {
    return "unauthorized";
  }

  const now = input.now ?? new Date();
  const rawToken = input.token ?? createInvitationToken();
  const prepared = await dependencies.invitationRepository.prepareResend({
    actorIdentityId: input.identityId,
    invitationId: input.invitationId,
    spaceId: input.spaceId,
    tokenHash: hashInvitationToken(rawToken),
    expiresAt: expirationFrom(now),
    now,
  });

  if (prepared.kind !== "prepared") {
    return prepared.kind;
  }

  const delivery = await deliverPreparedInvitation(
    dependencies,
    prepared.invitation,
    prepared.spaceName,
    rawToken,
    now,
  );
  return delivery === "failed" ? "delivery_failed" : delivery;
}

export async function cancelSpaceInvitation(
  dependencies: ManagementDependencies,
  input: {
    identityId: string;
    spaceId: string;
    invitationId: string;
    now?: Date;
  },
) {
  if (
    !(await canManageInvitations(dependencies, input.identityId, input.spaceId))
  ) {
    return { kind: "unauthorized" as const };
  }

  return dependencies.invitationRepository.cancelInvitation({
    actorIdentityId: input.identityId,
    invitationId: input.invitationId,
    spaceId: input.spaceId,
    now: input.now ?? new Date(),
  });
}

export async function inspectSpaceInvitation(
  repository: InvitationRepository,
  token: string,
  now = new Date(),
): Promise<InvitationPreview | null> {
  return repository.findPreview(hashInvitationToken(token), now);
}

export async function requestInvitedAccountSetup(
  repository: InvitationRepository,
  identityGateway: InvitedIdentityGateway,
  token: string,
  now = new Date(),
): Promise<"requested" | "invalid" | "delivery_failed"> {
  const target = await repository.findAccountSetupTarget(
    hashInvitationToken(token),
    now,
  );
  if (target.kind === "invalid") {
    return "invalid";
  }

  if (target.identityExists) {
    return "requested";
  }

  return (await identityGateway.sendAccountSetup(target.email)) === "sent"
    ? "requested"
    : "delivery_failed";
}

export async function acceptSpaceInvitation(
  repository: InvitationRepository,
  input: {
    token: string;
    identityId: string;
    identityEmail: string;
    emailVerified: boolean;
    now?: Date;
  },
): Promise<AcceptInvitationResult> {
  if (!input.emailVerified) {
    return { kind: "email_mismatch" };
  }

  return repository.acceptInvitation({
    tokenHash: hashInvitationToken(input.token),
    identityId: input.identityId,
    identityEmail: input.identityEmail,
    now: input.now ?? new Date(),
  });
}
