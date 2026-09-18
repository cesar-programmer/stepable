export type AuthenticatedIdentity = {
  id: string;
  email: string;
};

export type IdentityResult =
  { ok: true } | { ok: false; reason: "invalid" | "unavailable" };

export interface IdentityGateway {
  signIn(email: string, password: string): Promise<IdentityResult>;
  signOut(): Promise<void>;
  currentIdentity(): Promise<AuthenticatedIdentity | null>;
  requestPasswordRecovery(email: string): Promise<void>;
  updatePassword(password: string): Promise<IdentityResult>;
}
