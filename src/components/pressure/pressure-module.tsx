"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import {
  type SetupCandidate,
  type RegimeRead,
  type PressureTrend,
  type SubScoreBars,
  SETUP_META,
  REGIME_COLORS,
  TREND_META,
} from "@/lib/pressure/setups";
import type { PressureScore } from "@/lib/pressure/scoring";
import { STATE_LABELS, STATE_COLORS } from "@/lib/pressure/scoring";
import {
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Eye,
  Table,
  AlertTriangle,
  Minus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// ─── Types matching the API response ───

interface EnrichedSignal extends SetupCandidate {
  composite: number;
  trend: PressureTrend;
  whyNow: string;
  subScores: SubScoreBars;
}

interface PressureResponse {
  tokens: PressureScore[];
  count: number;
  signals: EnrichedSignal[];
  regime: RegimeRead | null;
  fetchedAt: string;
}

// ─── Format helpers ───

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

function fmtPct(n: number, sign = true): string {
  const s = sign && n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Main module ───

export function PressureModule() {
  const [showAllTable, setShowAllTable] = useState(false);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PressureResponse>({
    queryKey: ["pressure-v13"],
    queryFn: async () => {
      const r = await fetch("/api/pressure");
      if (!r.ok) throw new Error("Failed to fetch pressure data");
      return r.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const signals = useMemo(() => data?.signals ?? [], [data]);

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-10 py-7 max-w-[1400px] mx-auto">
        {/* ── Top bar ── */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-txt-muted mb-1.5">
              Flow Pressure · Hyperliquid
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-white">
              Today&rsquo;s best signals
            </h1>
            <p className="text-[13px] text-txt-secondary mt-1.5 leading-[1.5]">
              The strongest positioning setups on Hyperliquid right now, ranked by fit × confidence. Refreshes every 30s.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data?.regime && <RegimeChip regime={data.regime} />}
            <button
              onClick={() => setShowAllTable((v) => !v)}
              className="flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-surface-1 hover:bg-surface-2 text-[12px] text-txt-secondary hover:text-txt-primary transition-colors"
            >
              <Table className="w-3.5 h-3.5" />
              <span>{showAllTable ? "Hide" : "View"} all markets</span>
            </button>
          </div>
        </div>

        {/* ── Loading / error states ── */}
        {isLoading && (
          <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
            <div className="text-[13px] text-txt-secondary font-mono">
              Reading flow on Hyperliquid&hellip;
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
                The flow data feed isn&rsquo;t responding. Try refreshing in a moment.
              </div>
            </div>
          </div>
        )}

        {!isLoading && !isError && signals.length === 0 && (
          <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
            <div className="text-[16px] font-semibold text-white mb-2">
              No clean setups on Hyperliquid right now
            </div>
            <p className="text-[13px] text-txt-secondary max-w-[480px] mx-auto leading-[1.6]">
              The market isn&rsquo;t offering high-conviction positioning patterns at the moment. We poll every 30 seconds — check back shortly.
            </p>
          </div>
        )}

        {/* ── Stacked signal cards ── */}
        {!isLoading && signals.length > 0 && (
          <div className="flex flex-col gap-3">
            {signals.map((s, i) => (
              <SignalCard
                key={s.score.symbol}
                signal={s}
                rank={i + 1}
                onOpenChart={() => setChartSymbol(s.score.symbol)}
              />
            ))}
          </div>
        )}

        {/* ── View-all collapsible table ── */}
        {showAllTable && data?.tokens && (
          <AllMarketsTable
            tokens={data.tokens}
            onOpenChart={(sym) => setChartSymbol(sym)}
          />
        )}

        {/* ── Calibration note ── */}
        <div className="mt-8 px-1 text-[10.5px] text-txt-dim leading-[1.6] font-mono max-w-[800px]">
          Entries, invalidations, and targets are algorithmic starting points based on
          current price action and recent volatility — not validated signals. Use them as
          a frame for your own analysis. OI 24h change and pressure trend are derived from
          current data; once we snapshot OI hourly into Supabase, the trend signal will
          reflect real change over time.
        </div>
      </div>

      {/* ── TradingView modal ── */}
      {chartSymbol && (
        <TradingViewModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SIGNAL CARD — the same shape for every ranked signal
// ════════════════════════════════════════════════════════════════

function SignalCard({
  signal,
  rank,
  onOpenChart,
}: {
  signal: EnrichedSignal;
  rank: number;
  onOpenChart: () => void;
}) {
  const { score, plan, thesis, fitScore, setupType, trend, whyNow, subScores } = signal;
  const isLong = plan.direction === "LONG";
  const meta = SETUP_META[setupType];
  const trendMeta = TREND_META[trend];

  return (
    <div className="relative rounded-[14px] border border-border bg-gradient-to-b from-surface-1 to-surface-0 overflow-hidden">
      {/* Setup-type accent on the left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: meta.color }}
      />

      <div className="p-6 md:p-7 pl-7 md:pl-8">
        {/* ── Header row: rank, token, price, direction ── */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-start gap-4 min-w-0">
            {/* Rank */}
            <div className="shrink-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-txt-muted leading-none mb-1">
                Rank
              </div>
              <div className="text-[28px] font-semibold leading-none text-white tracking-[-0.02em]">
                #{rank}
              </div>
            </div>
            {/* Token info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.1em] font-semibold"
                  style={{
                    background: `${meta.color}1a`,
                    color: meta.color,
                    border: `1px solid ${meta.color}33`,
                  }}
                >
                  {meta.label}
                </span>
                <TrendBadge trend={trend} />
                <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-txt-muted">
                  fit {fitScore} · {plan.confidence}
                </span>
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-[28px] font-semibold tracking-[-0.025em] text-white leading-[1]">
                  {score.symbol}
                </h2>
                <div className="text-[18px] font-mono text-txt-primary">
                  ${fmtPrice(score.raw.markPrice)}
                </div>
                <div
                  className="text-[12px] font-mono"
                  style={{ color: score.priceChange24hPct >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {fmtPct(score.priceChange24hPct)} 24h
                </div>
              </div>
            </div>
          </div>
          <DirectionBadge direction={plan.direction} />
        </div>

        {/* ── Thesis ── */}
        <p className="text-[13.5px] text-txt-primary leading-[1.55] mb-2.5 max-w-[820px]">
          {thesis}
        </p>

        {/* ── Why this matters NOW ── */}
        <div
          className="mb-5 pl-3 border-l-2 text-[12.5px] leading-[1.5] max-w-[820px]"
          style={{ borderColor: trendMeta.color }}
        >
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-txt-muted mr-2">
            Why now
          </span>
          <span className="text-txt-secondary">{whyNow}</span>
        </div>

        {/* ── Sub-score breakdown bars ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <SubScoreBar label="OI 24h" raw={subScores.oi.raw} pct={subScores.oi.pct} />
          <SubScoreBar label="Funding 8h" raw={subScores.funding.raw} pct={subScores.funding.pct} />
          <SubScoreBar label="Momentum 24h" raw={subScores.momentum.raw} pct={subScores.momentum.pct} />
          <SubScoreBar label="OI/Vol" raw={subScores.oiVol.raw} pct={subScores.oiVol.pct} />
        </div>

        {/* ── Trade plan grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <PlanCell
            label="Entry zone"
            value={`$${fmtPrice(plan.entryZoneLow)} – $${fmtPrice(plan.entryZoneHigh)}`}
          />
          <PlanCell
            label="Invalidation"
            value={`$${fmtPrice(plan.invalidation)}`}
            tone="risk"
          />
          <PlanCell
            label="First target"
            value={`$${fmtPrice(plan.target)}`}
            tone="ok"
          />
          <PlanCell label="Risk:reward" value={computeRR(plan)} />
        </div>

        {/* ── Action row ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-4 text-[11px] text-txt-muted font-mono flex-wrap">
            <span>OI {fmtUsd(score.raw.openInterestUsd)}</span>
            <span>·</span>
            <span>Vol 24h {fmtUsd(score.raw.dayVolumeUsd)}</span>
            <span>·</span>
            <span className="text-txt-secondary">
              State: {STATE_LABELS[score.state]}
            </span>
          </div>
          <button
            onClick={onOpenChart}
            className="flex items-center gap-2 px-3.5 h-9 rounded-md bg-white text-black hover:bg-white/90 text-[12px] font-semibold transition-colors"
          >
            Open chart {isLong ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUB-SCORE BAR — shows the strength of a single input component
// ════════════════════════════════════════════════════════════════

function SubScoreBar({ label, raw, pct }: { label: string; raw: string; pct: number }) {
  // Color the bar by how "loaded" the input is. Higher = more pressure on that axis.
  const color = pct > 70 ? "#FFFFFF" : pct > 40 ? "#A1A1AA" : "#52525B";
  return (
    <div className="rounded-[10px] border border-border bg-bg-base px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-txt-muted">
          {label}
        </span>
        <span className="text-[11px] font-mono font-medium text-txt-primary">
          {raw}
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TREND BADGE — building / peaking / fading
// ════════════════════════════════════════════════════════════════

function TrendBadge({ trend }: { trend: PressureTrend }) {
  const m = TREND_META[trend];
  const Icon = m.icon === "up" ? ArrowUp : m.icon === "down" ? ArrowDown : Minus;
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.08em] font-semibold"
      style={{
        background: `${m.color}1a`,
        color: m.color,
        border: `1px solid ${m.color}33`,
      }}
      title={m.note}
    >
      <Icon className="w-3 h-3" />
      {m.label}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIRECTION BADGE
// ════════════════════════════════════════════════════════════════

function DirectionBadge({ direction }: { direction: "LONG" | "SHORT" | "WATCH" }) {
  const isLong = direction === "LONG";
  const isWatch = direction === "WATCH";
  const color = isWatch ? "#A1A1AA" : isLong ? "#10B981" : "#EF4444";
  const Icon = isWatch ? Eye : isLong ? TrendingUp : TrendingDown;
  return (
    <div
      className="flex items-center gap-2 px-3.5 h-9 rounded-md font-semibold text-[12px]"
      style={{
        background: `${color}1a`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {direction}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PLAN CELL
// ════════════════════════════════════════════════════════════════

function PlanCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "risk" | "ok";
}) {
  const valColor =
    tone === "risk" ? "#EF4444" : tone === "ok" ? "#10B981" : "var(--color-txt-primary)";
  return (
    <div className="rounded-[10px] border bg-bg-base px-3 py-2.5 border-border">
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-txt-muted mb-1">
        {label}
      </div>
      <div className="text-[13px] font-mono font-medium" style={{ color: valColor }}>
        {value}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REGIME CHIP — compact version in the top bar
// ════════════════════════════════════════════════════════════════

function RegimeChip({ regime }: { regime: RegimeRead }) {
  const color = REGIME_COLORS[regime.regime];
  return (
    <div
      className="flex items-center gap-2 px-3 h-9 rounded-md border bg-surface-1 text-[11px] font-mono"
      style={{ borderColor: `${color}30` }}
      title={regime.detail}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="text-txt-muted uppercase tracking-[0.1em]">Regime</span>
      <span className="font-semibold" style={{ color }}>{regime.label}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VIEW-ALL TABLE
// ════════════════════════════════════════════════════════════════

function AllMarketsTable({
  tokens,
  onOpenChart,
}: {
  tokens: PressureScore[];
  onOpenChart: (symbol: string) => void;
}) {
  return (
    <div className="mt-7 rounded-[12px] border border-border bg-surface-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-white">All markets · sorted by pressure score</h2>
        <span className="text-[11px] text-txt-muted font-mono">{tokens.length} markets</span>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-surface-2 sticky top-0">
            <tr className="text-left text-[10px] font-mono uppercase tracking-[0.08em] text-txt-muted">
              <th className="px-4 py-2.5">Token</th>
              <th className="px-4 py-2.5 text-right">Price</th>
              <th className="px-4 py-2.5 text-right">24h</th>
              <th className="px-4 py-2.5">State</th>
              <th className="px-4 py-2.5 text-right">Funding 8h</th>
              <th className="px-4 py-2.5 text-right">OI</th>
              <th className="px-4 py-2.5 text-right">Score</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr
                key={t.symbol}
                className="border-t border-border hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => onOpenChart(t.symbol)}
              >
                <td className="px-4 py-2.5 font-medium text-white">{t.symbol}</td>
                <td className="px-4 py-2.5 text-right font-mono">${fmtPrice(t.raw.markPrice)}</td>
                <td
                  className="px-4 py-2.5 text-right font-mono"
                  style={{ color: t.priceChange24hPct >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {fmtPct(t.priceChange24hPct)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.05em]"
                    style={{
                      background: STATE_COLORS[t.state].bg,
                      color: STATE_COLORS[t.state].fg,
                      border: `1px solid ${STATE_COLORS[t.state].border}`,
                    }}
                  >
                    {STATE_LABELS[t.state]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-txt-secondary">
                  {t.raw.fundingRate8h.toFixed(3)}%
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-txt-secondary">
                  {fmtUsd(t.raw.openInterestUsd)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-mono font-semibold" style={{ color: scoreColor(t.score) }}>
                    {t.score}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <ChevronRight className="w-3 h-3 text-txt-muted" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Helpers ───

function computeRR(plan: {
  entryZoneLow: number;
  entryZoneHigh: number;
  invalidation: number;
  target: number;
}): string {
  const entryMid = (plan.entryZoneLow + plan.entryZoneHigh) / 2;
  const risk = Math.abs(entryMid - plan.invalidation);
  const reward = Math.abs(plan.target - entryMid);
  if (risk === 0) return "—";
  const rr = reward / risk;
  if (rr > 99) return ">99:1";
  return `${rr.toFixed(1)}:1`;
}

function scoreColor(s: number): string {
  if (s >= 75) return "#10B981";
  if (s >= 50) return "#F97316";
  if (s >= 25) return "#A1A1AA";
  return "#EF4444";
}
