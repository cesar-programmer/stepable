import type {
  AccessRepository,
  MembershipStatus,
  SpaceAction,
  SpaceMembership,
  SpaceRole,
  UserSpace,
} from "./contract.ts";

const permissions: Record<SpaceRole, readonly SpaceAction[]> = {
  responsable: [
    "consultar_espacio",
    "gestionar_invitaciones",
    "gestionar_miembros",
  ],
  integrante: ["consultar_espacio"],
};

function isMembershipStatus(value: unknown): value is MembershipStatus {
  return value === "activa" || value === "revocada";
}

function isSpaceRole(value: unknown): value is SpaceRole {
  return value === "responsable" || value === "integrante";
}

function isSpaceAction(value: unknown): value is SpaceAction {
  return (
    value === "consultar_espacio" ||
    value === "gestionar_invitaciones" ||
    value === "gestionar_miembros"
  );
}

export function allowsSpaceAction(
  status: unknown,
  role: unknown,
  action: unknown,
): boolean {
  if (
    !isMembershipStatus(status) ||
    status !== "activa" ||
    !isSpaceRole(role) ||
    !isSpaceAction(action)
  ) {
    return false;
  }

  return permissions[role].includes(action);
}

function toUserSpace(membership: SpaceMembership): UserSpace {
  return {
    id: membership.id,
    slug: membership.slug,
    name: membership.name,
    role: membership.role,
  };
}

export async function listAuthorizedSpaces(
  repository: AccessRepository,
  identityId: string,
): Promise<UserSpace[]> {
  const memberships = await repository.listActiveSpacesForIdentity(identityId);

  return memberships
    .filter((membership) =>
      allowsSpaceAction(
        membership.status,
        membership.role,
        "consultar_espacio",
      ),
    )
    .map(toUserSpace);
}

export async function authorizeSpaceAction(
  repository: AccessRepository,
  identityId: string,
  spaceId: string,
  action: unknown,
): Promise<UserSpace | null> {
  const membership = await repository.findSpaceMembershipForIdentity(
    identityId,
    spaceId,
  );

  if (
    !membership ||
    !allowsSpaceAction(membership.status, membership.role, action)
  ) {
    return null;
  }

  return toUserSpace(membership);
}
