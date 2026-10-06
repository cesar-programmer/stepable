import { describe, expect, it } from "vitest";

import { parseUsageLimits } from "../../lib/ai-budget-config.ts";
import { modelRates } from "../../lib/ai-pricing.ts";

import { chatTokenBound, costMicroUsd, embeddingTokenBound } from "./meter.ts";

describe("consumption estimates", () => {
  it("bounds tokens by UTF-8 bytes plus framing, and output by its cap", () => {
    // "ñ" takes 2 bytes; byte length never undercounts BPE tokens.
    expect(
      chatTokenBound({ system: "ab", user: "ñ", maxOutputTokens: 700 }),
    ).toEqual({ inputTokens: 2 + 2 + 64, outputTokens: 700 });
    expect(embeddingTokenBound(["abc", "de"])).toBe(3 + 64 + 2 + 64);
  });

  it("prices tokens in micro-dollars, rounding up", () => {
    const rate = modelRates["openai:gpt-4.1-mini"];
    expect(rate).toEqual({ inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 });
    // 1037 in + 1149 out ≈ 0.0022532 USD.
    expect(costMicroUsd(rate, 1037, 1149)).toBe(2254);
    expect(
      costMicroUsd(modelRates["openai:text-embedding-3-small"], 1001, 0),
    ).toBe(21);
  });

  it("uses the approved limits unless the operator configures others", () => {
    expect(parseUsageLimits({})).toEqual({
      globalMicroUsd: 1_000_000,
      spaceDailyMicroUsd: 200_000,
      userDailyQueries: 40,
    });
    expect(
      parseUsageLimits({ STEPABLE_AI_BUDGET_GLOBAL_USD: "2.5" }).globalMicroUsd,
    ).toBe(2_500_000);
    expect(() =>
      parseUsageLimits({ STEPABLE_AI_USER_DAILY_QUERIES: "-1" }),
    ).toThrow();
  });
});
