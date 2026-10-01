export const spaceRoles = ["responsable", "integrante"] as const;
export const membershipStatuses = ["activa", "revocada"] as const;
export const spaceActions = [
  "consultar_espacio",
  "gestionar_invitaciones",
  "gestionar_miembros",
  "abandonar_espacio",
  "consultar_fuentes",
  "gestionar_fuentes",
  "consultar_rutas",
  "gestionar_rutas",
] as const;

export type SpaceRole = (typeof spaceRoles)[number];
export type MembershipStatus = (typeof membershipStatuses)[number];
export type SpaceAction = (typeof spaceActions)[number];

export type UserSpace = {
  id: string;
  slug: string;
  name: string;
  role: SpaceRole;
};

export type SpaceMembership = UserSpace & {
  status: MembershipStatus;
};

export type BootstrapSpaceInput = {
  email: string;
  slug: string;
  name: string;
};

export type BootstrapSpaceResult = {
  created: boolean;
  space: UserSpace;
};

export interface AccessRepository {
  bootstrapSpace(input: BootstrapSpaceInput): Promise<BootstrapSpaceResult>;
  listActiveSpacesForIdentity(identityId: string): Promise<SpaceMembership[]>;
  findSpaceMembershipForIdentity(
    identityId: string,
    spaceId: string,
  ): Promise<SpaceMembership | null>;
}

export class IdentityNotFoundError extends Error {
  constructor() {
    super("La identidad local indicada no existe.");
    this.name = "IdentityNotFoundError";
  }
}

export class SpaceBootstrapConflictError extends Error {
  constructor() {
    super(
      "El espacio ya existe con datos incompatibles o su responsable inicial ya no conserva una membresía activa con ese rol.",
    );
    this.name = "SpaceBootstrapConflictError";
  }
}
