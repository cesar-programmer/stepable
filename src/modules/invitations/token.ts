import { createHash, randomBytes } from "node:crypto";

export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildInvitationAcceptUrl(
  applicationUrl: string,
  token: string,
): string {
  const url = new URL("/invitations/accept", applicationUrl);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}
