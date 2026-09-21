import type { MembershipRepository } from "./contract.ts";

export function listSpaceMembers(
  repository: MembershipRepository,
  input: { identityId: string; spaceId: string },
) {
  return repository.listMembersForManager(input.identityId, input.spaceId);
}

export function changeSpaceMemberRole(
  repository: MembershipRepository,
  input: {
    identityId: string;
    spaceId: string;
    targetProfileId: string;
    role: "responsable" | "integrante";
  },
) {
  return repository.changeMemberRole({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    targetProfileId: input.targetProfileId,
    role: input.role,
  });
}

export function revokeSpaceMember(
  repository: MembershipRepository,
  input: {
    identityId: string;
    spaceId: string;
    targetProfileId: string;
  },
) {
  return repository.revokeMember({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
    targetProfileId: input.targetProfileId,
  });
}

export function leaveSpace(
  repository: MembershipRepository,
  input: { identityId: string; spaceId: string },
) {
  return repository.leaveSpace({
    actorIdentityId: input.identityId,
    spaceId: input.spaceId,
  });
}
