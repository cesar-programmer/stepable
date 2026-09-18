import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAdminClient,
  createLocalTestIdentity,
  createPublicClient,
  deleteLocalTestIdentity,
  getLocalAuthTestConfig,
  type LocalTestIdentity,
  waitForRecoveryLink,
} from "../support/local-auth";

const config = getLocalAuthTestConfig();
const admin = createAdminClient(config);
let identity: LocalTestIdentity;

describe("Supabase Auth local", () => {
  beforeAll(async () => {
    identity = await createLocalTestIdentity(admin);
  });

  afterAll(async () => {
    if (identity?.id) {
      await deleteLocalTestIdentity(admin, identity.id);
    }
  });

  it("rejects public registration", async () => {
    const client = createPublicClient(config);
    const { data, error } = await client.auth.signUp({
      email: `public-${crypto.randomUUID()}@example.test`,
      password: `Not-created-${crypto.randomUUID()}!`,
    });

    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("rejects incorrect credentials and accepts correct credentials", async () => {
    const client = createPublicClient(config);
    const invalid = await client.auth.signInWithPassword({
      email: identity.email,
      password: `${identity.password}-incorrect`,
    });
    expect(invalid.error).not.toBeNull();

    const valid = await client.auth.signInWithPassword({
      email: identity.email,
      password: identity.password,
    });
    expect(valid.error).toBeNull();
    expect(valid.data.user?.email).toBe(identity.email);

    await client.auth.signOut();
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it("recovers the password and rejects reuse of the recovery token", async () => {
    const requester = createPublicClient(config);
    const request = await requester.auth.resetPasswordForEmail(identity.email);
    expect(request.error).toBeNull();

    const recoveryLink = await waitForRecoveryLink(
      config.mailpitUrl,
      identity.email,
    );
    const recoveryUrl = new URL(recoveryLink);
    const tokenHash = recoveryUrl.searchParams.get("token_hash");
    expect(tokenHash).toBeTruthy();

    const recovery = createPublicClient(config);
    const verified = await recovery.auth.verifyOtp({
      token_hash: tokenHash!,
      type: "recovery",
    });
    expect(verified.error).toBeNull();

    const update = await recovery.auth.updateUser({
      password: identity.updatedPassword,
    });
    expect(update.error).toBeNull();

    const reused = await createPublicClient(config).auth.verifyOtp({
      token_hash: tokenHash!,
      type: "recovery",
    });
    expect(reused.error).not.toBeNull();

    const oldPassword = await createPublicClient(
      config,
    ).auth.signInWithPassword({
      email: identity.email,
      password: identity.password,
    });
    expect(oldPassword.error).not.toBeNull();

    const newPassword = await createPublicClient(
      config,
    ).auth.signInWithPassword({
      email: identity.email,
      password: identity.updatedPassword,
    });
    expect(newPassword.error).toBeNull();
  });
});
