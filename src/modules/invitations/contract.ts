import type { SpaceRole } from "../access/contract.ts";

export const invitationStatuses = [
  "pendiente",
  "aceptada",
  "revocada",
  "vencida",
] as const;
export const invitationDeliveryStatuses = [
  "pendiente",
  "enviada",
  "fallida",
] as const;

export type InvitationStatus = (typeof invitationStatuses)[number];
export type InvitationDeliveryStatus =
  (typeof invitationDeliveryStatuses)[number];

export type SpaceInvitation = {
  id: string;
  spaceId: string;
  email: string;
  role: SpaceRole;
  status: InvitationStatus;
  deliveryStatus: InvitationDeliveryStatus;
  expiresAt: Date;
  deliveredAt: Date | null;
  createdAt: Date;
};

export type InvitationPreview = {
  spaceName: string;
  role: SpaceRole;
  status: InvitationStatus;
  expiresAt: Date;
};

export type CreateInvitationInput = {
  spaceId: string;
  email: string;
  role: SpaceRole;
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
};

export type CreateInvitationResult =
  | { kind: "created"; invitation: SpaceInvitation; spaceName: string }
  | { kind: "pending_exists" }
  | { kind: "already_member"; role: SpaceRole }
  | { kind: "member_role_conflict"; role: SpaceRole };

export type PrepareResendResult =
  | { kind: "prepared"; invitation: SpaceInvitation; spaceName: string }
  | { kind: "not_found" | "not_resendable" };

export type CancelInvitationResult =
  | { kind: "cancelled" | "already_cancelled" }
  | { kind: "not_found" | "not_cancellable" };

export type AcceptInvitationResult =
  | { kind: "joined" | "reactivated" | "already_member"; spaceId: string }
  | { kind: "already_accepted"; spaceId: string }
  | {
      kind:
        | "invalid"
        | "expired"
        | "cancelled"
        | "email_mismatch"
        | "member_role_conflict";
    };

export type AccountSetupTarget =
  | { kind: "available"; email: string; identityExists: boolean }
  | { kind: "invalid" };

export interface InvitationRepository {
  createInvitation(
    input: CreateInvitationInput,
  ): Promise<CreateInvitationResult>;
  listInvitations(spaceId: string, now: Date): Promise<SpaceInvitation[]>;
  prepareResend(input: {
    invitationId: string;
    spaceId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<PrepareResendResult>;
  cancelInvitation(input: {
    invitationId: string;
    spaceId: string;
    now: Date;
  }): Promise<CancelInvitationResult>;
  recordDelivery(input: {
    invitationId: string;
    tokenHash: string;
    deliveryStatus: "enviada" | "fallida";
    now: Date;
  }): Promise<boolean>;
  findPreview(tokenHash: string, now: Date): Promise<InvitationPreview | null>;
  findAccountSetupTarget(
    tokenHash: string,
    now: Date,
  ): Promise<AccountSetupTarget>;
  acceptInvitation(input: {
    tokenHash: string;
    identityId: string;
    identityEmail: string;
    now: Date;
  }): Promise<AcceptInvitationResult>;
}

export interface InvitationMailer {
  sendInvitation(input: {
    recipient: string;
    spaceName: string;
    role: SpaceRole;
    acceptUrl: string;
  }): Promise<void>;
}

export interface InvitedIdentityGateway {
  sendAccountSetup(email: string): Promise<"sent" | "failed">;
}
