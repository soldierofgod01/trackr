"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import {
  Anchor,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  ChevronRight,
  Users,
} from "lucide-react";

// ─── Types matching the API response ───

interface WhaleWallet {
  address: string;
  alias: string;
  category: "hl_trader" | "smart_money" | "vault";
  notes?: string;
}

interface WhalePosition {
  coin: string;
  side: "long" | "short";
  sizeCoin: number;
  notionalUsd: number;
  entryPrice: number | null;
  unrealizedPnl: number;
  leverage: number;
  roePct: number;
}

interface WhaleFill {
  coin: string;
  side: "buy" | "sell";
  price: number;
  sizeCoin: number;
  notionalUsd: number;
  direction: string;
  closedPnl: number;
  timestamp: number;
}

interface WhaleSnapshot {
  whale: WhaleWallet;
  accountValueUsd: number;
  totalPositionNotional: number;
  positions: WhalePosition[];
  recentFills: WhaleFill[];
}

interface TokenAggregate {
  coin: string;
  netNotionalUsd: number;
  longNotional: number;
  shortNotional: number;
  whaleCount: number;
  avgRoePct: number;
  recentFillsCount24h: number;
  netFlow24hUsd: number;
}

interface RecentTrade extends WhaleFill {
  whale: string;
  whaleAddress: string;
}

interface WhaleFlowResponse {
  whaleCount: number;
  whaleCountConfigured: number;
  snapshots: WhaleSnapshot[];
  tokenAggregates: TokenAggregate[];
  recentTrades: RecentTrade[];
  fetchedAt: string;
}

// ─── Format helpers ───

function fmtUsd(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : signed && n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Main module ───

export function WhaleFlowModule() {
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [tab, setTab] = useState<"aggregates" | "trades" | "whales">("aggregates");

  const { data, isLoading, isError } = useQuery<WhaleFlowResponse>({
    queryKey: ["whale-flow"],
    queryFn: async () => {
      const r = await fetch("/api/whale-flow");
      if (!r.ok) throw new Error("Failed to fetch whale flow");
      return r.json();
    },
    refetchInterval: 60_000, // Whale flow doesn't move as fast as price; 60s is fine
    refetchOnWindowFocus: false,
  });

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-10 py-7 max-w-[1400px] mx-auto">
        {/* ── Top bar ── */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-txt-muted mb-1.5">
              Whale Flow · Hyperliquid
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-white">
              What the smart money is doing
            </h1>
            <p className="text-[13px] text-txt-secondary mt-1.5 leading-[1.5]">
              Live positions and trades from a curated set of top Hyperliquid traders.
              Refreshes every 60s.
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-3 px-3 h-9 rounded-md border border-border bg-surface-1 text-[11px] font-mono">
              <Users className="w-3.5 h-3.5 text-txt-muted" />
              <span className="text-txt-secondary">
                <span className="text-white font-semibold">{data.whaleCount}</span>
                <span className="text-txt-muted"> / {data.whaleCountConfigured} whales live</span>
              </span>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 p-0.5 mb-5 rounded-[7px] bg-surface-1 border border-border w-fit">
          {(
            [
              { id: "aggregates" as const, label: "Token positioning" },
              { id: "trades" as const, label: "Recent trades" },
              { id: "whales" as const, label: "Whales" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-[5px] text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-surface-2 text-txt-primary"
                  : "text-txt-muted hover:text-txt-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── States ── */}
        {isLoading && (
          <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
            <div className="text-[13px] text-txt-secondary font-mono">
              Reading whale activity on Hyperliquid&hellip;
            </div>
          </div>
        )}

        {isError && (
          <div className="rounded-[14px] border border-risk/30 bg-risk/5 p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-white mb-1">
                Couldn&rsquo;t reach Hyperliquid
              </div>
              <div className="text-[12px] text-txt-secondary">
                Whale data feed isn&rsquo;t responding. Try refreshing in a moment.
              </div>
            </div>
          </div>
        )}

        {/* ── Tab content ── */}
        {!isLoading && data && tab === "aggregates" && (
          <TokenAggregatesView
            aggregates={data.tokenAggregates}
            onOpenChart={(sym) => setChartSymbol(sym)}
          />
        )}

        {!isLoading && data && tab === "trades" && (
          <RecentTradesView
            trades={data.recentTrades}
            onOpenChart={(sym) => setChartSymbol(sym)}
          />
        )}

        {!isLoading && data && tab === "whales" && (
          <WhalesView snapshots={data.snapshots} onOpenChart={(sym) => setChartSymbol(sym)} />
        )}

        {/* ── Calibration note ── */}
        <div className="mt-8 px-1 text-[10.5px] text-txt-dim leading-[1.6] font-mono max-w-[800px]">
          Whale list is hand-curated from public Hyperliquid leaderboard data.
          Positions and fills come direct from HL&rsquo;s `clearinghouseState` and
          `userFills` endpoints. No automated leaderboard ingestion yet — the
          curated list rotates manually.
        </div>
      </div>

      {chartSymbol && (
        <TradingViewModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TOKEN AGGREGATES VIEW
// ════════════════════════════════════════════════════════════════

function TokenAggregatesView({
  aggregates,
  onOpenChart,
}: {
  aggregates: TokenAggregate[];
  onOpenChart: (sym: string) => void;
}) {
  if (aggregates.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
        <div className="text-[14px] text-txt-secondary">
          No whale positions found yet. They may be flat right now, or the data is still loading.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-white">Net whale positioning by token</h2>
        <span className="text-[11px] text-txt-muted font-mono">
          {aggregates.length} tokens · sorted by absolute net notional
        </span>
      </div>
      <div className="max-h-[700px] overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 sticky top-0">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.08em] text-txt-muted">
              <th className="px-4 py-2.5">Token</th>
              <th className="px-4 py-2.5 text-right">Net positioning</th>
              <th className="px-4 py-2.5 text-right">Longs</th>
              <th className="px-4 py-2.5 text-right">Shorts</th>
              <th className="px-4 py-2.5 text-right">Whales</th>
              <th className="px-4 py-2.5 text-right">Net flow 24h</th>
              <th className="px-4 py-2.5 text-right">Avg ROE</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {aggregates.map((a) => {
              const netIsLong = a.netNotionalUsd >= 0;
              const netColor = netIsLong ? "#10B981" : "#EF4444";
              const flowColor = a.netFlow24hUsd >= 0 ? "#10B981" : "#EF4444";
              return (
                <tr
                  key={a.coin}
                  onClick={() => onOpenChart(a.coin)}
                  className="border-t border-border hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-medium text-white">{a.coin}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: netColor }}>
                    {netIsLong ? "+" : "-"}
                    {fmtUsd(Math.abs(a.netNotionalUsd))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-txt-secondary">
                    {a.longNotional > 0 ? fmtUsd(a.longNotional) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-txt-secondary">
                    {a.shortNotional > 0 ? fmtUsd(a.shortNotional) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-txt-secondary">
                    {a.whaleCount}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: flowColor }}>
                    {a.netFlow24hUsd !== 0
                      ? `${a.netFlow24hUsd > 0 ? "+" : "-"}${fmtUsd(Math.abs(a.netFlow24hUsd))}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    <span style={{ color: a.avgRoePct >= 0 ? "#10B981" : "#EF4444" }}>
                      {a.avgRoePct >= 0 ? "+" : ""}
                      {a.avgRoePct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ChevronRight className="w-3 h-3 text-txt-muted" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// RECENT TRADES VIEW
// ════════════════════════════════════════════════════════════════

function RecentTradesView({
  trades,
  onOpenChart,
}: {
  trades: RecentTrade[];
  onOpenChart: (sym: string) => void;
}) {
  if (trades.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
        <div className="text-[14px] text-txt-secondary">
          No whale trades in the last 24 hours.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {trades.map((t, idx) => {
        const isBuy = t.side === "buy";
        const Icon = isBuy ? ArrowUpRight : ArrowDownRight;
        const color = isBuy ? "#10B981" : "#EF4444";
        return (
          <div
            key={`${t.whaleAddress}-${t.timestamp}-${idx}`}
            onClick={() => onOpenChart(t.coin)}
            className="flex items-center gap-3 px-4 py-3 rounded-[10px] border border-border bg-surface-1 hover:bg-surface-2 cursor-pointer transition-colors"
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${color}1a`, border: `1px solid ${color}33` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[14px] font-semibold text-white">{t.coin}</span>
                <span
                  className="text-[11px] font-mono uppercase tracking-[0.08em] font-semibold"
                  style={{ color }}
                >
                  {t.direction}
                </span>
                <span className="text-[11px] font-mono text-txt-secondary">
                  · {fmtUsd(t.notionalUsd)} @ ${fmtPrice(t.price)}
                </span>
              </div>
              <div className="text-[10.5px] font-mono text-txt-muted mt-0.5">
                {t.whale} ({fmtAddress(t.whaleAddress)}) · {fmtAgo(t.timestamp)}
                {t.closedPnl !== 0 && (
                  <span
                    className="ml-2"
                    style={{ color: t.closedPnl > 0 ? "#10B981" : "#EF4444" }}
                  >
                    realized {t.closedPnl > 0 ? "+" : ""}
                    {fmtUsd(t.closedPnl)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-txt-muted shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// WHALES VIEW (each whale's snapshot)
// ════════════════════════════════════════════════════════════════

function WhalesView({
  snapshots,
  onOpenChart,
}: {
  snapshots: WhaleSnapshot[];
  onOpenChart: (sym: string) => void;
}) {
  if (snapshots.length === 0) {
    return (
      <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
        <div className="text-[14px] text-txt-secondary">No whale data available right now.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {snapshots.map((s) => (
        <div
          key={s.whale.address}
          className="rounded-[12px] border border-border bg-surface-1 p-5"
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Anchor className="w-4 h-4 text-radar" />
              <span className="text-[14px] font-semibold text-white">{s.whale.alias}</span>
              <span className="text-[10.5px] font-mono text-txt-muted">
                {fmtAddress(s.whale.address)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-txt-muted">
              <span>
                Account: <span className="text-txt-primary">{fmtUsd(s.accountValueUsd)}</span>
              </span>
              <span>·</span>
              <span>
                Total notional:{" "}
                <span className="text-txt-primary">{fmtUsd(s.totalPositionNotional)}</span>
              </span>
            </div>
          </div>

          {s.positions.length === 0 ? (
            <div className="text-[12px] text-txt-muted py-2">Flat — no open positions</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {s.positions.map((p) => {
                const sideColor = p.side === "long" ? "#10B981" : "#EF4444";
                return (
                  <div
                    key={p.coin}
                    onClick={() => onOpenChart(p.coin)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-bg-base hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    <span className="text-[13px] font-semibold text-white">{p.coin}</span>
                    <span
                      className="text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: `${sideColor}1a`,
                        color: sideColor,
                        border: `1px solid ${sideColor}33`,
                      }}
                    >
                      {p.side} {p.leverage}x
                    </span>
                    <span className="text-[11px] font-mono text-txt-secondary ml-auto">
                      {fmtUsd(p.notionalUsd)}
                    </span>
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: p.roePct >= 0 ? "#10B981" : "#EF4444" }}
                    >
                      {p.roePct >= 0 ? "+" : ""}
                      {p.roePct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
