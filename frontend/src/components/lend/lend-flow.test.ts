import { describe, expect, it } from "vitest";
import type { MarketDetail, Quote } from "@/lib/api/types";
import {
  buildUnsignedOfferPayload,
  canPreviewOffer,
  lendDetails,
} from "./lend-flow";

const market = {
  minimumAmount: "100.000000",
  fixedApr: "12.00",
  patCoverage: "100.20",
} as MarketDetail;

const quote = {
  principal: "1000.000000",
  apr: "12.00",
  expiresAt: "2026-09-01T00:10:00Z",
} as Quote;

describe("lend offer flow", () => {
  it("requires validation and preview before a simulated offer", () => {
    expect(
      canPreviewOffer({ hasQuote: true, previewed: false, offerAprError: undefined }),
    ).toBe(false);
    expect(
      canPreviewOffer({ hasQuote: true, previewed: true, offerAprError: undefined }),
    ).toBe(true);
    expect(
      canPreviewOffer({ hasQuote: false, previewed: true, offerAprError: undefined }),
    ).toBe(false);
    expect(
      canPreviewOffer({ hasQuote: true, previewed: true, offerAprError: "invalid" }),
    ).toBe(false);
  });
  it("maps API market terms", () => {
    expect(lendDetails(market)).toContainEqual(["PAT coverage", "100.20%"]);
    expect(lendDetails(market)).toContainEqual(["Fixed APR", "12.00%"]);
  });
  it("builds the documented unsigned payload without inventing a signature", () => {
    expect(
      buildUnsignedOfferPayload({
        quote,
        marketId: `0x${"A".repeat(64)}`,
        chainId: 31337,
        wallet: `0x${"D".repeat(40)}`,
        offerApr: "15.500000",
      }),
    ).toBe(
      [
        "Awakening Mock Offer",
        "chainId:31337",
        `wallet:0x${"d".repeat(40)}`,
        `marketId:0x${"a".repeat(64)}`,
        "amount:1000",
        "apr:15.5",
        "expiry:2026-09-01T00:10:00Z",
      ].join("\n"),
    );
  });
});
