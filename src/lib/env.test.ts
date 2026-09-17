import { describe, expect, it } from "vitest";

import { parseLocalEnvironment } from "./env";

describe("parseLocalEnvironment", () => {
  it("accepts a complete local configuration", () => {
    expect(
      parseLocalEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-key",
        DATABASE_URL: "postgresql://postgres:local@127.0.0.1:54322/postgres",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-key",
      DATABASE_URL: "postgresql://postgres:local@127.0.0.1:54322/postgres",
    });
  });

  it("rejects an incomplete local configuration", () => {
    expect(() => parseLocalEnvironment({})).toThrow();
  });
});
