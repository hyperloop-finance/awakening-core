import { buildQuote } from "./quotes";
import { getMockMarketCatalog, getMockPortfolio, getMockRuntimeConfig } from "./mock";
import { resolveDataProfile } from "./profile";
import type { MarketSummary, PortfolioPayload, Quote, QuoteSide, RuntimeConfig } from "./types";

export type ApiError = { message: string; status?: number };

export function normalizeApiError(error: unknown): ApiError {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { detail?: unknown; message?: unknown; status?: unknown };
    const message = typeof candidate.detail === "string" ? candidate.detail : typeof candidate.message === "string" ? candidate.message : undefined;
    return { message: message ?? "Unable to reach the Awakening API. Check the API URL and try again.", status: typeof candidate.status === "number" ? candidate.status : undefined };
  }
  return { message: "Unable to reach the Awakening API. Check the API URL and try again.", status: undefined };
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}${path}`);
  if (!response.ok) throw normalizeApiError({ ...(await response.json().catch(() => null)), status: response.status });
  return response.json() as Promise<T>;
}

export const awakeningApi = {
  async markets(): Promise<MarketSummary[]> {
    if (resolveDataProfile() === "mock") return getMockMarketCatalog();
    const response = await request<{ data: MarketSummary[] }>("/api/v1/markets");
    return response.data;
  },
  async market(id: string): Promise<MarketSummary> {
    if (resolveDataProfile() === "mock") {
      const market = getMockMarketCatalog().find((candidate) => candidate.id === id);
      if (!market) throw { detail: "Market not found", status: 404 };
      return market;
    }
    return request<MarketSummary>(`/api/v1/markets/${id}`);
  },
  async quote(marketId: string, side: QuoteSide, amount: string): Promise<Quote> {
    const market = await this.market(marketId);
    if (resolveDataProfile() === "mock") return buildQuote({ side, amount, market });
    return request<Quote>(`/api/v1/markets/${marketId}/quote?side=${side}&amount=${encodeURIComponent(amount)}`);
  },
  async portfolio(wallet: string): Promise<PortfolioPayload> {
    if (resolveDataProfile() === "mock") return getMockPortfolio(wallet);
    return request<PortfolioPayload>(`/api/v1/portfolio/${wallet}`);
  },
  async runtimeConfig(): Promise<RuntimeConfig> {
    if (resolveDataProfile() === "mock") return getMockRuntimeConfig();
    return request<RuntimeConfig>("/api/v1/config");
  },
};
