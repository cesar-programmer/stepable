import { describe, expect, it } from "vitest";

import {
  buildInvitationAcceptUrl,
  createInvitationToken,
  hashInvitationToken,
} from "./token.ts";

describe("invitation tokens", () => {
  it("creates opaque tokens and stable one-way hashes", () => {
    const token = createInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
    expect(hashInvitationToken(token)).not.toContain(token);
  });

  it("keeps the token in the URL fragment", () => {
    const url = new URL(
      buildInvitationAcceptUrl(
        "http://127.0.0.1:3000",
        "valid_token_value_1234567890123456",
      ),
    );
    expect(url.pathname).toBe("/invitations/accept");
    expect(url.search).toBe("");
    expect(url.hash).toContain("token=");
  });
});
