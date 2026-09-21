import type { OrderSide } from "@/lib/api/types";
import { parseFixedDecimal } from "@/lib/fixed-decimal";

export type OrderDraft = { wallet?: string; marketId: string; side: OrderSide; amount: string; aprPercent: string; expiry: string };
export function validateOrderDraft(draft: OrderDraft, now: Date): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.wallet) errors.wallet = "Connect a wallet or use the demo wallet.";
  if (!draft.marketId) errors.marketId = "Choose a market.";
  try { if (parseFixedDecimal(draft.amount) <= BigInt(0)) errors.amount = "Enter an amount greater than zero."; } catch { errors.amount = "Enter a valid amount with up to 8 decimals."; }
  try { const apr = parseFixedDecimal(draft.aprPercent); if (apr <= BigInt(0) || apr > BigInt(100) * BigInt(100_000_000)) errors.aprPercent = "APR must be between 0% and 100%."; } catch { errors.aprPercent = "Enter a valid APR percentage."; }
  if (!draft.expiry || Date.parse(draft.expiry) <= now.getTime()) errors.expiry = "Expiry must be in the future.";
  return errors;
}
