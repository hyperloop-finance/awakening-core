"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { awakeningApi, normalizeApiError } from "@/lib/api/client";
import type { Order, OrderSide } from "@/lib/api/types";
import { percentToDecimalRate, formatRateAsPercent } from "@/lib/fixed-decimal";
import { formatDecimal } from "@/lib/format";
import { useWalletIdentity } from "@/components/shell/wallet";
import { EmptyState, ErrorState, LoadingState } from "@/components/shell/states";
import { validateOrderDraft } from "./order-form";

export function OrdersScreen() {
  const params = useSearchParams(); const { wallet, openWallet } = useWalletIdentity();
  const [side, setSide] = useState<OrderSide>(params.get("side") === "LEND" ? "LEND" : "BORROW");
  const [marketId, setMarketId] = useState(params.get("marketId") ?? "");
  const [amount, setAmount] = useState("5000"); const [apr, setApr] = useState("8.1"); const [expiry, setExpiry] = useState("2026-12-01T00:00");
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string>(); const [pending, setPending] = useState(false);
  const load = useCallback(async () => { if (!wallet) return; setLoading(true); setError(undefined); try { setOrders(await awakeningApi.orders(wallet, side)); } catch (reason) { setError(normalizeApiError(reason).message); } finally { setLoading(false); } }, [wallet, side]);
  useEffect(() => { void load(); }, [load]);
  const draft = { wallet, marketId, side, amount, aprPercent: apr, expiry }; const errors = validateOrderDraft(draft, new Date());
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (Object.keys(errors).length || !wallet) return; setPending(true); setError(undefined); try { await awakeningApi.createOrder({ wallet, marketId, side, amount, apr: percentToDecimalRate(apr), expiry: new Date(expiry).toISOString() }); await load(); } catch (reason) { setError(normalizeApiError(reason).message); } finally { setPending(false); } };
  const cancel = async (id: string) => { if (!wallet) return; setPending(true); try { await awakeningApi.cancelOrder(id, wallet); await load(); } catch (reason) { setError(normalizeApiError(reason).message); } finally { setPending(false); } };
  return <>
    <header className="portfolio-hero"><div className="portfolio-title-line"><h1 className="page-heading">Orders</h1><span className="preview-status"><span />IN-MEMORY PREVIEW · NO SIGNATURE</span></div><p className="page-subtitle">Set the amount and fixed APR you want. These orders demonstrate the lifecycle only and reset with the local service.</p></header>
    {!wallet ? <EmptyState title="Connect a wallet to manage orders"><button className="inline-button" onClick={() => openWallet()}>Connect wallet</button></EmptyState> : <div className="workspace-grid">
      <form className="instrument-panel order-ticket" onSubmit={submit}><div className="side-tabs"><button type="button" className={side === "BORROW" ? "active" : ""} onClick={() => setSide("BORROW")}>Borrow order</button><button type="button" className={side === "LEND" ? "active" : ""} onClick={() => setSide("LEND")}>Lend order</button></div>
        <label>Market ID<input value={marketId} onChange={(e) => setMarketId(e.target.value)} placeholder="0x…" /></label>
        <label>Amount · USDC<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />{errors.amount && <small className="field-error">{errors.amount}</small>}</label>
        <label>Fixed APR · %<input value={apr} onChange={(e) => setApr(e.target.value)} inputMode="decimal" />{errors.aprPercent && <small className="field-error">{errors.aprPercent}</small>}</label>
        <label>Expiry · UTC<input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />{errors.expiry && <small className="field-error">{errors.expiry}</small>}</label>
        <button className="primary-action" disabled={pending || Object.keys(errors).length > 0}>{pending ? "Saving preview…" : `Place ${side.toLowerCase()} order`}</button><small>Preview only · no wallet signature or chain transaction.</small>
      </form>
      <section className="instrument-panel order-ledger"><h2>{side === "BORROW" ? "Borrow" : "Lend"} orders</h2>{loading ? <LoadingState label="Loading orders…" /> : error ? <ErrorState message={error} retry={load} /> : orders.length === 0 ? <EmptyState title="No orders yet">Create the first preview order using the ticket.</EmptyState> : <div className="compact-ledger">{orders.map((order) => <article key={order.id}><div><strong>{formatDecimal(order.remainingAmount)} USDC</strong><span>{formatRateAsPercent(order.apr)} · expires {order.expiry.slice(0, 10)}</span></div><span className={`status-badge status-${order.status.toLowerCase()}`}>{order.status}</span>{["OPEN", "PARTIALLY_FILLED"].includes(order.status) && <button className="small-action secondary" disabled={pending} onClick={() => void cancel(order.id)}>Cancel</button>}</article>)}</div>}</section>
    </div>}
  </>;
}
