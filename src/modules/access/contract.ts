export const spaceRoles = ["responsable", "integrante"] as const;

export type SpaceRole = (typeof spaceRoles)[number];

export type UserSpace = {
  id: string;
  slug: string;
  name: string;
  role: SpaceRole;
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
  listSpacesForIdentity(identityId: string): Promise<UserSpace[]>;
  findSpaceForIdentity(
    identityId: string,
    spaceId: string,
  ): Promise<UserSpace | null>;
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
      "El espacio ya existe con un nombre o responsable inicial diferente.",
    );
    this.name = "SpaceBootstrapConflictError";
  }
}
