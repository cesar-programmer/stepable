import type { MembershipStatus, SpaceRole } from "../access/contract.ts";

export type SpaceMember = {
  profileId: string;
  email: string | null;
  role: SpaceRole;
  status: MembershipStatus;
};

export type MemberMutationFailure =
  "unauthorized" | "not_found" | "inactive" | "last_responsible";

export type ChangeMemberRoleResult =
  { kind: "updated" | "unchanged" } | { kind: MemberMutationFailure };

export type RevokeMemberResult =
  { kind: "revoked" } | { kind: MemberMutationFailure };

export type LeaveSpaceResult =
  { kind: "left" } | { kind: "unauthorized" | "last_responsible" };

export interface MembershipRepository {
  listMembersForManager(
    actorIdentityId: string,
    spaceId: string,
  ): Promise<SpaceMember[] | null>;
  changeMemberRole(input: {
    actorIdentityId: string;
    spaceId: string;
    targetProfileId: string;
    role: SpaceRole;
  }): Promise<ChangeMemberRoleResult>;
  revokeMember(input: {
    actorIdentityId: string;
    spaceId: string;
    targetProfileId: string;
  }): Promise<RevokeMemberResult>;
  leaveSpace(input: {
    actorIdentityId: string;
    spaceId: string;
  }): Promise<LeaveSpaceResult>;
}
