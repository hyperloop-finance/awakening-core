import {
  getMockMarket,
  getMockMarketCatalog,
  getMockPortfolio,
  getMockRuntimeConfig,
  mockQuote,
} from "./mock";
import { resolveDataProfile } from "./profile";
import type {
  MarketDetail,
  MarketSummary,
  Offer,
  PortfolioPayload,
  Quote,
  QuoteSide,
  RuntimeConfig,
  SignedOffer,
} from "./types";
import {
  parseMarketDetail,
  parseMarketsResponse,
  parseOffer,
  parsePortfolio,
  parseQuote,
  parseRuntimeConfig,
} from "./wire";

export type ApiError = { message: string; status?: number };

export function normalizeApiError(error: unknown): ApiError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { detail?: unknown; message?: unknown; status?: unknown };
    const message =
      typeof candidate.detail === "string"
        ? candidate.detail
        : typeof candidate.message === "string"
          ? candidate.message
          : undefined;
    return {
      message:
        message ?? "Unable to reach the Awakening API. Check the API URL and try again.",
      status: typeof candidate.status === "number" ? candidate.status : undefined,
    };
  }
  return {
    message: "Unable to reach the Awakening API. Check the API URL and try again.",
    status: undefined,
  };
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}${path}`,
    init,
  );
  if (!response.ok) {
    const problem = await response.json().catch(() => undefined);
    throw normalizeApiError({
      ...(typeof problem === "object" && problem !== null ? problem : {}),
      status: response.status,
    });
  }
  return response.json();
}

export const awakeningApi = {
  async markets(signal?: AbortSignal): Promise<MarketSummary[]> {
    if (resolveDataProfile() === "mock") return getMockMarketCatalog();
    return parseMarketsResponse(await request("/api/v1/markets", { signal })).data;
  },

  async market(id: string, signal?: AbortSignal): Promise<MarketDetail> {
    if (resolveDataProfile() === "mock") {
      const market = getMockMarket(id);
      if (!market) throw { detail: "Market not found", status: 404 };
      return market;
    }
    return parseMarketDetail(
      await request(`/api/v1/markets/${encodeURIComponent(id)}`, { signal }),
    );
  },

  async quote(
    marketId: string,
    side: QuoteSide,
    amount: string,
    signal?: AbortSignal,
  ): Promise<Quote> {
    if (resolveDataProfile() === "mock") {
      const market = getMockMarket(marketId);
      if (!market) throw { detail: "Market not found", status: 404 };
      return mockQuote(market, side, amount);
    }
    return parseQuote(
      await request(
        `/api/v1/markets/${encodeURIComponent(marketId)}/quote?side=${side}&amount=${encodeURIComponent(amount)}`,
        { signal },
      ),
    );
  },

  async portfolio(wallet: string, signal?: AbortSignal): Promise<PortfolioPayload> {
    if (resolveDataProfile() === "mock") return getMockPortfolio(wallet);
    return parsePortfolio(
      await request(`/api/v1/portfolio/${encodeURIComponent(wallet)}`, { signal }),
    );
  },

  async runtimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
    if (resolveDataProfile() === "mock") return getMockRuntimeConfig();
    return parseRuntimeConfig(await request("/api/v1/config", { signal }));
  },

  async createOffer(offer: SignedOffer, signal?: AbortSignal): Promise<Offer> {
    return parseOffer(
      await request("/api/v1/offers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(offer),
        signal,
      }),
    );
  },
};
