import { describe, expect, it } from "vitest";

import { contractsAreReady } from "./config";

describe("contract readiness", () => {
  it("requires every configured EVM contract address and rejects placeholders", () => {
    expect(
      contractsAreReady({
        awakeningAddress: "0x1111111111111111111111111111111111111111",
        settlementAddress: "0x2222222222222222222222222222222222222222",
        patAddress: "0x3333333333333333333333333333333333333333",
        optionVaultAddress: "0x4444444444444444444444444444444444444444",
      }),
    ).toBe(true);
    expect(
      contractsAreReady({
        awakeningAddress: "0x1111111111111111111111111111111111111111",
        settlementAddress: null,
        patAddress: "0x3333333333333333333333333333333333333333",
        optionVaultAddress: "0x4444444444444444444444444444444444444444",
      }),
    ).toBe(false);
  });
});
