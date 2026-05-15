"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import {
  type SetupType,
  type SetupCandidate,
  type RegimeRead,
  SETUP_META,
  REGIME_COLORS,
} from "@/lib/pressure/setups";
import type { PressureScore } from "@/lib/pressure/scoring";
import { STATE_LABELS, STATE_COLORS } from "@/lib/pressure/scoring";
import {
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Eye,
  Settings2,
  Table,
  AlertTriangle,
} from "lucide-react";

// ─── Types matching the API response ───

interface PressureResponse {
  tokens: PressureScore[];
  count: number;
  setups: {
    squeeze: SetupCandidate[];
    trend: SetupCandidate[];
    reversal: SetupCandidate[];
  };
  regime: RegimeRead | null;
  fetchedAt: string;
}

// ─── localStorage helper for setup preference ───

const STYLE_KEY = "trackr:pressure:setup_style";

function readSetupStyle(): SetupType | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STYLE_KEY);
  if (v === "squeeze" || v === "trend" || v === "reversal") return v;
  return null;
}

function writeSetupStyle(s: SetupType) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STYLE_KEY, s);
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
  // Setup style preference: null = not yet picked (first-time visit)
  const [setupStyle, setSetupStyleState] = useState<SetupType | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showAllTable, setShowAllTable] = useState(false);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [showStylePicker, setShowStylePicker] = useState(false);

  useEffect(() => {
    setSetupStyleState(readSetupStyle());
    setHydrated(true);
  }, []);

  const setSetupStyle = (s: SetupType) => {
    setSetupStyleState(s);
    writeSetupStyle(s);
    setShowStylePicker(false);
  };

  const { data, isLoading, isError } = useQuery<PressureResponse>({
    queryKey: ["pressure-v11"],
    queryFn: async () => {
      const r = await fetch("/api/pressure");
      if (!r.ok) throw new Error("Failed to fetch pressure data");
      return r.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  // Setups for the currently selected style
  const setupsForStyle = useMemo(() => {
    if (!data || !setupStyle) return [];
    return data.setups[setupStyle] ?? [];
  }, [data, setupStyle]);

  const heroSetup = setupsForStyle[0];
  const runnerUps = setupsForStyle.slice(1, 5);

  // ── Pre-hydration: render nothing to avoid SSR/CSR flash ──
  if (!hydrated) {
    return <div className="flex-1 bg-bg-base" />;
  }

  // ── First-time visit: show style picker ──
  if (!setupStyle) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg-base">
        <SetupStylePicker
          onPick={setSetupStyle}
          isFirstTime
        />
      </div>
    );
  }

  // ── Style picker overlay (when reopened from settings button) ──
  if (showStylePicker) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg-base">
        <SetupStylePicker
          onPick={setSetupStyle}
          onCancel={() => setShowStylePicker(false)}
          currentStyle={setupStyle}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-10 py-7 max-w-[1400px] mx-auto">
        {/* ── Top bar ── */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-txt-muted">
                Flow Pressure
              </span>
              <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-txt-dim">
                · {SETUP_META[setupStyle].label.toLowerCase()} setups
              </span>
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-white">
              Today&rsquo;s best trades
            </h1>
            <p className="text-[13px] text-txt-secondary mt-1.5 leading-[1.5]">
              {SETUP_META[setupStyle].description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStylePicker(true)}
              className="flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-surface-1 hover:bg-surface-2 text-[12px] text-txt-secondary hover:text-txt-primary transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Setup style: {SETUP_META[setupStyle].label}</span>
            </button>
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

        {/* ── No setups for this style right now ── */}
        {!isLoading && !isError && setupsForStyle.length === 0 && (
          <div className="rounded-[14px] border border-border bg-surface-1 p-12 text-center">
            <div className="text-[16px] font-semibold text-white mb-2">
              No clean {SETUP_META[setupStyle].label.toLowerCase()} setups on Hyperliquid right now
            </div>
            <p className="text-[13px] text-txt-secondary max-w-[480px] mx-auto leading-[1.6]">
              The market isn&rsquo;t offering this pattern at the moment. Try a different setup style, or wait for conditions to shift. We poll every 30 seconds.
            </p>
            <button
              onClick={() => setShowStylePicker(true)}
              className="mt-5 px-4 h-9 rounded-md bg-surface-2 border border-border hover:border-txt-muted text-[12px] text-txt-primary transition-colors"
            >
              Try a different setup style
            </button>
          </div>
        )}

        {/* ── Hero + runner-ups ── */}
        {!isLoading && heroSetup && (
          <>
            <HeroCard
              setup={heroSetup}
              setupStyle={setupStyle}
              onOpenChart={() => setChartSymbol(heroSetup.score.symbol)}
            />

            {runnerUps.length > 0 && (
              <div className="mt-7">
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="text-[13px] font-semibold text-white uppercase tracking-[0.08em]">
                    Other setups
                  </h2>
                  <span className="text-[11px] text-txt-muted font-mono">
                    {runnerUps.length} more matching {SETUP_META[setupStyle].label.toLowerCase()}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {runnerUps.map((s) => (
                    <RunnerUpCard
                      key={s.score.symbol}
                      setup={s}
                      onOpenChart={() => setChartSymbol(s.score.symbol)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Market regime strip ── */}
        {data?.regime && (
          <RegimeStrip regime={data.regime} />
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
          a frame for your own analysis. OI 24h change is approximated from price + funding
          direction; we don&rsquo;t yet snapshot historical OI.
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
// HERO CARD — the trade right now
// ════════════════════════════════════════════════════════════════

function HeroCard({
  setup,
  setupStyle,
  onOpenChart,
}: {
  setup: SetupCandidate;
  setupStyle: SetupType;
  onOpenChart: () => void;
}) {
  const { score, plan, thesis, fitScore } = setup;
  const isLong = plan.direction === "LONG";
  const meta = SETUP_META[setupStyle];

  return (
    <div className="relative rounded-[16px] border border-border bg-gradient-to-b from-surface-1 to-surface-0 overflow-hidden">
      {/* Top strip — setup type indicator */}
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}55)` }}
      />

      <div className="p-7 md:p-8">
        {/* Header row */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.1em] font-semibold"
                style={{
                  background: `${meta.color}1a`,
                  color: meta.color,
                  border: `1px solid ${meta.color}33`,
                }}
              >
                {meta.label} setup
              </span>
              <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-txt-muted">
                · highest conviction · score {fitScore}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-[42px] font-semibold tracking-[-0.03em] text-white leading-[1]">
                {score.symbol}
              </h2>
              <div className="text-[24px] font-mono text-txt-primary">
                ${fmtPrice(score.raw.markPrice)}
              </div>
              <div
                className="text-[13px] font-mono"
                style={{
                  color: score.priceChange24hPct >= 0 ? "#10B981" : "#EF4444",
                }}
              >
                {fmtPct(score.priceChange24hPct)} 24h
              </div>
            </div>
          </div>
          <DirectionBadge direction={plan.direction} size="large" />
        </div>

        {/* Thesis */}
        <p className="text-[14.5px] text-txt-primary leading-[1.55] mb-6 max-w-[820px]">
          {thesis}
        </p>

        {/* Trade plan grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <PlanCell
            label="Entry zone"
            value={`$${fmtPrice(plan.entryZoneLow)} – $${fmtPrice(plan.entryZoneHigh)}`}
            highlight={false}
          />
          <PlanCell
            label="Invalidation"
            value={`$${fmtPrice(plan.invalidation)}`}
            highlight={false}
            tone="risk"
          />
          <PlanCell
            label="First target"
            value={`$${fmtPrice(plan.target)}`}
            highlight={false}
            tone="ok"
          />
          <PlanCell
            label="Risk:reward"
            value={computeRR(plan, score.raw.markPrice)}
            highlight={false}
          />
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-5 border-t border-border">
          <div className="flex items-center gap-4 text-[11px] text-txt-muted font-mono">
            <span>OI {fmtUsd(score.raw.openInterestUsd)}</span>
            <span>·</span>
            <span>Funding {(score.raw.fundingRate8h).toFixed(3)}% 8h</span>
            <span>·</span>
            <span>Vol 24h {fmtUsd(score.raw.dayVolumeUsd)}</span>
            <span>·</span>
            <span className="text-txt-secondary">
              Confidence:{" "}
              <span style={{ color: confidenceColor(plan.confidence) }}>
                {plan.confidence}
              </span>
            </span>
          </div>
          <button
            onClick={onOpenChart}
            className="flex items-center gap-2 px-4 h-10 rounded-md bg-white text-black hover:bg-white/90 text-[13px] font-semibold transition-colors"
          >
            Open chart {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// RUNNER-UP CARD
// ════════════════════════════════════════════════════════════════

function RunnerUpCard({
  setup,
  onOpenChart,
}: {
  setup: SetupCandidate;
  onOpenChart: () => void;
}) {
  const { score, plan, thesis, fitScore } = setup;

  return (
    <div className="rounded-[12px] border border-border bg-surface-1 p-4 hover:border-txt-muted transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-0.5">
            <div className="text-[16px] font-semibold text-white">{score.symbol}</div>
            <div className="text-[12px] font-mono text-txt-primary">
              ${fmtPrice(score.raw.markPrice)}
            </div>
            <div
              className="text-[10.5px] font-mono"
              style={{ color: score.priceChange24hPct >= 0 ? "#10B981" : "#EF4444" }}
            >
              {fmtPct(score.priceChange24hPct)}
            </div>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-txt-muted">
            score {fitScore} · {plan.confidence} confidence
          </div>
        </div>
        <DirectionBadge direction={plan.direction} size="small" />
      </div>

      <p className="text-[12.5px] text-txt-secondary leading-[1.5] mb-3 line-clamp-2">
        {thesis}
      </p>

      <div className="flex items-center justify-between text-[10.5px] font-mono text-txt-dim gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span>
            entry <span className="text-txt-secondary">${fmtPrice(plan.entryZoneLow)}</span>
          </span>
          <span>
            inv <span className="text-risk">${fmtPrice(plan.invalidation)}</span>
          </span>
          <span>
            tgt <span className="text-radar">${fmtPrice(plan.target)}</span>
          </span>
        </div>
        <button
          onClick={onOpenChart}
          className="text-txt-secondary hover:text-white flex items-center gap-1 shrink-0"
        >
          chart <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PLAN CELL (used in hero card grid)
// ════════════════════════════════════════════════════════════════

function PlanCell({
  label,
  value,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  highlight: boolean;
  tone?: "risk" | "ok";
}) {
  const valColor =
    tone === "risk" ? "#EF4444" : tone === "ok" ? "#10B981" : "var(--color-txt-primary)";
  return (
    <div
      className={`rounded-[10px] border bg-bg-base px-3.5 py-3 ${
        highlight ? "border-txt-muted" : "border-border"
      }`}
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-txt-muted mb-1">
        {label}
      </div>
      <div className="text-[14px] font-mono font-medium" style={{ color: valColor }}>
        {value}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DIRECTION BADGE
// ════════════════════════════════════════════════════════════════

function DirectionBadge({
  direction,
  size,
}: {
  direction: "LONG" | "SHORT" | "WATCH";
  size: "small" | "large";
}) {
  const isLong = direction === "LONG";
  const isWatch = direction === "WATCH";
  const color = isWatch ? "#A1A1AA" : isLong ? "#10B981" : "#EF4444";
  const Icon = isWatch ? Eye : isLong ? TrendingUp : TrendingDown;

  if (size === "large") {
    return (
      <div
        className="flex items-center gap-2 px-4 h-10 rounded-md font-semibold text-[13px]"
        style={{
          background: `${color}1a`,
          color,
          border: `1px solid ${color}40`,
        }}
      >
        <Icon className="w-4 h-4" />
        {direction}
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}
    >
      <Icon className="w-3 h-3" />
      {direction}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MARKET REGIME STRIP
// ════════════════════════════════════════════════════════════════

function RegimeStrip({ regime }: { regime: RegimeRead }) {
  const color = REGIME_COLORS[regime.regime];
  return (
    <div className="mt-7 rounded-[12px] border border-border bg-surface-1 px-5 py-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-txt-muted">
            Market regime
          </span>
          <span
            className="text-[14px] font-semibold"
            style={{ color }}
          >
            {regime.label}
          </span>
        </div>
        <span className="text-[12.5px] text-txt-secondary flex-1 min-w-[200px]">
          {regime.detail}
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-txt-dim">
          <span>{regime.pctPositiveOI}% building</span>
          <span>·</span>
          <span>avg score {regime.avgScore}</span>
          <span>·</span>
          <span>funding {regime.avgFundingBps.toFixed(1)}bps</span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// VIEW-ALL TABLE (collapsible "screener" view)
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
                  <span
                    className="font-mono font-semibold"
                    style={{ color: scoreColor(t.score) }}
                  >
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

// ════════════════════════════════════════════════════════════════
// SETUP STYLE PICKER (full-page on first visit, overlay on change)
// ════════════════════════════════════════════════════════════════

function SetupStylePicker({
  onPick,
  onCancel,
  isFirstTime,
  currentStyle,
}: {
  onPick: (s: SetupType) => void;
  onCancel?: () => void;
  isFirstTime?: boolean;
  currentStyle?: SetupType;
}) {
  return (
    <div className="px-8 md:px-10 py-12 max-w-[1100px] mx-auto">
      <div className="mb-9 text-center">
        <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-txt-muted mb-2">
          {isFirstTime ? "Welcome to Flow Pressure" : "Change setup style"}
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-white mb-2">
          What kind of setup do you trade?
        </h1>
        <p className="text-[14px] text-txt-secondary max-w-[560px] mx-auto leading-[1.55]">
          Pick one — we&rsquo;ll surface the best matching setup on Hyperliquid right now.
          You can change this any time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["squeeze", "trend", "reversal"] as SetupType[]).map((s) => {
          const meta = SETUP_META[s];
          const isCurrent = currentStyle === s;
          return (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="text-left rounded-[14px] border bg-surface-1 hover:bg-surface-2 p-6 transition-colors group"
              style={{
                borderColor: isCurrent ? meta.color : undefined,
              }}
            >
              <div className="text-[36px] mb-3">{meta.emoji}</div>
              <h3
                className="text-[18px] font-semibold mb-1.5 tracking-[-0.015em]"
                style={{ color: meta.color }}
              >
                {meta.label}
              </h3>
              <p className="text-[13px] text-txt-secondary leading-[1.5] mb-4">
                {meta.description}
              </p>
              <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-txt-muted group-hover:text-txt-primary transition-colors flex items-center gap-1">
                Pick {meta.label.toLowerCase()} <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      {onCancel && (
        <div className="mt-6 text-center">
          <button
            onClick={onCancel}
            className="text-[12px] text-txt-muted hover:text-txt-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───

function computeRR(plan: { entryZoneLow: number; entryZoneHigh: number; invalidation: number; target: number; direction: "LONG" | "SHORT" | "WATCH" }, mark: number): string {
  const entryMid = (plan.entryZoneLow + plan.entryZoneHigh) / 2;
  const risk = Math.abs(entryMid - plan.invalidation);
  const reward = Math.abs(plan.target - entryMid);
  if (risk === 0) return "—";
  const rr = reward / risk;
  if (rr > 99) return ">99:1";
  return `${rr.toFixed(1)}:1`;
}

function confidenceColor(c: "high" | "medium" | "low"): string {
  if (c === "high") return "#10B981";
  if (c === "medium") return "#F97316";
  return "#A1A1AA";
}

function scoreColor(s: number): string {
  if (s >= 75) return "#10B981";
  if (s >= 50) return "#F97316";
  if (s >= 25) return "#A1A1AA";
  return "#EF4444";
}
