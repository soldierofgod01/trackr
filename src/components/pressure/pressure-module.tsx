"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePriceStream } from "@/lib/hooks/use-price-stream";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import {
  STATE_LABELS,
  STATE_COLORS,
  type PressureScore,
  type PressureState,
} from "@/lib/pressure/scoring";
import { Activity, TrendingUp, TrendingDown, Zap, Flame, AlertTriangle, Loader2, AlertCircle, Filter, ChevronDown, ChevronUp } from "lucide-react";

async function fetchPressureData(): Promise<PressureScore[]> {
  const res = await fetch("/api/pressure");
  if (!res.ok) throw new Error("Failed to fetch pressure data");
  const data = await res.json();
  return data.tokens ?? [];
}

type FilterId = "all" | "building" | "squeeze" | "overheated" | "distribution" | "neutral";

const FILTERS: { id: FilterId; label: string; icon: React.ComponentType<{className?: string}>; matches: (s: PressureState) => boolean }[] = [
  { id: "all",          label: "All",                icon: Filter,         matches: () => true },
  { id: "building",     label: "Building pressure",  icon: TrendingUp,     matches: (s) => s === "building" },
  { id: "squeeze",      label: "Squeeze setups",     icon: Zap,            matches: (s) => s === "squeeze_setup" },
  { id: "overheated",   label: "Overheated",         icon: Flame,          matches: (s) => s === "overheated_longs" || s === "crowded_shorts" },
  { id: "distribution", label: "Distribution risk",  icon: TrendingDown,   matches: (s) => s === "distribution_risk" || s === "distributing" },
];

type SortKey = "score" | "oi_change" | "funding_abs" | "momentum";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "score",       label: "Pressure score" },
  { id: "oi_change",   label: "OI change" },
  { id: "funding_abs", label: "Funding extremity" },
  { id: "momentum",    label: "24h change" },
];

function formatUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toExponential(2);
}

// Score → color (gradient from red → yellow → green)
function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 55) return "#84CC16";
  if (score >= 40) return "#F59E0B";
  if (score >= 25) return "#F97316";
  return "#EF4444";
}

export function PressureModule() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const { data: tokens, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["pressure"],
    queryFn: fetchPressureData,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Live prices for the price column flash
  const { prices: livePrices } = usePriceStream();

  const filtered = useMemo(() => {
    if (!tokens) return [];
    const matcher = FILTERS.find((f) => f.id === filter)!.matches;
    const result = tokens.filter((t) => matcher(t.state));

    result.sort((a, b) => {
      switch (sort) {
        case "score":       return b.score - a.score;
        case "oi_change":   return b.raw.openInterestChange24hPct - a.raw.openInterestChange24hPct;
        case "funding_abs": return Math.abs(b.raw.fundingRate8h) - Math.abs(a.raw.fundingRate8h);
        case "momentum":    return b.priceChange24hPct - a.priceChange24hPct;
      }
    });
    return result;
  }, [tokens, filter, sort]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;
    return {
      buildingCount: tokens.filter((t) => t.state === "building").length,
      squeezeCount: tokens.filter((t) => t.state === "squeeze_setup").length,
      overheatedCount: tokens.filter((t) => t.state === "overheated_longs" || t.state === "crowded_shorts").length,
      distributionCount: tokens.filter((t) => t.state === "distribution_risk" || t.state === "distributing").length,
      totalOI: tokens.reduce((s, t) => s + t.raw.openInterestUsd, 0),
      avgScore: Math.round(tokens.reduce((s, t) => s + t.score, 0) / tokens.length),
    };
  }, [tokens]);

  const secsSinceUpdate = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 md:px-10 py-8 max-w-[1500px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none">
              Flow Pressure
            </h1>
            <div className="mt-[10px] flex items-center gap-[10px] text-[12.5px] text-txt-muted">
              <span>Where capital is positioning. Score 0–100 across every Hyperliquid perp.</span>
              <span>·</span>
              {isLoading ? (
                <span className="font-mono text-[11px] inline-flex items-center gap-1.5">
                  <Loader2 className="w-[11px] h-[11px] animate-spin" /> Computing
                </span>
              ) : isError ? (
                <span className="font-mono text-[11px] text-warning inline-flex items-center gap-1.5">
                  <AlertCircle className="w-[11px] h-[11px]" /> API error
                </span>
              ) : (
                <span className="font-mono text-[11px] inline-flex items-center gap-1.5">
                  <span className="w-[6px] h-[6px] rounded-full bg-positive animate-pulse" />
                  <span className="text-positive">LIVE</span>
                  <span className="text-txt-muted">· {tokens?.length ?? 0} perps · {secsSinceUpdate}s ago</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px] bg-border border border-border rounded-[13px] overflow-hidden mb-6">
            <StatCell label="Avg score" value={String(stats.avgScore)} sub="across all perps" />
            <StatCell label="Building" value={String(stats.buildingCount)} sub="positions accumulating" color="#10B981" />
            <StatCell label="Squeeze" value={String(stats.squeezeCount)} sub="setups detected" color="#22D3EE" />
            <StatCell label="Overheated" value={String(stats.overheatedCount)} sub="crowded positioning" color="#F97316" />
            <StatCell label="Total OI" value={formatUSD(stats.totalOI)} sub="across HL perps" />
          </div>
        )}

        {/* Filter + sort row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              const count = f.id === "all"
                ? tokens?.length ?? 0
                : tokens?.filter((t) => f.matches(t.state)).length ?? 0;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[9px] text-[12px] font-medium transition-all whitespace-nowrap border ${
                    filter === f.id
                      ? "bg-white/[0.08] border-white/15 text-white"
                      : "bg-[#0A0A0A] border-border text-txt-secondary hover:text-white hover:border-border-strong"
                  }`}
                >
                  <Icon className="w-[13px] h-[13px]" />
                  {f.label}
                  <span className="font-mono text-[10px] text-txt-muted">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-txt-muted uppercase tracking-[0.08em] text-[10px] font-medium">Sort:</span>
            <div className="flex gap-1">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`px-2.5 py-1 rounded-[6px] transition-colors font-mono text-[11.5px] ${
                    sort === s.id ? "bg-[#1C1C1C] text-white" : "text-txt-muted hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pressure table */}
        <div className="bg-[#0A0A0A] border border-border rounded-[13px] overflow-hidden">
          <div
            className="grid gap-3 px-5 py-3 border-b border-border text-[9.5px] text-txt-muted uppercase tracking-[0.08em] font-medium"
            style={{ gridTemplateColumns: "minmax(180px, 1.5fr) 100px 88px 100px 88px 110px 36px" }}
          >
            <span>Token</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span>State</span>
            <span className="text-right">Funding 8h</span>
            <span>Pressure</span>
            <span></span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-txt-muted text-[13px]">
              Loading pressure data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-txt-muted text-[13px]">
              No tokens match this filter
            </div>
          ) : (
            filtered.map((t) => (
              <PressureRow
                key={t.symbol}
                t={t}
                isExpanded={expanded === t.symbol}
                onToggle={() => setExpanded(expanded === t.symbol ? null : t.symbol)}
                livePrice={livePrices[t.symbol]?.price}
                onOpenChart={() => setChartSymbol(t.symbol)}
              />
            ))
          )}
        </div>

        <div className="h-8" />
      </div>

      {chartSymbol && (
        <TradingViewModal
          symbol={chartSymbol}
          onClose={() => setChartSymbol(null)}
        />
      )}
    </div>
  );
}

function StatCell({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-black px-5 py-4 flex flex-col gap-1 hover:bg-[#0A0A0A] transition-colors">
      <div className="text-[10.5px] text-txt-muted font-medium uppercase tracking-[0.08em]">
        {label}
      </div>
      <div
        className="font-mono text-[22px] font-medium tracking-[-0.025em] leading-[1.05]"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-[10px] text-txt-muted">{sub}</div>
    </div>
  );
}

function PressureRow({
  t,
  isExpanded,
  onToggle,
  livePrice,
  onOpenChart,
}: {
  t: PressureScore;
  isExpanded: boolean;
  onToggle: () => void;
  livePrice?: number;
  onOpenChart: () => void;
}) {
  const stateColor = STATE_COLORS[t.state];
  const score = t.score;
  const color = scoreColor(score);
  const displayPrice = livePrice ?? t.raw.markPrice;
  const isLive = livePrice !== undefined;

  const fundingColor =
    Math.abs(t.raw.fundingRate8h) >= 0.05
      ? t.raw.fundingRate8h > 0 ? "text-negative" : "text-positive"
      : "text-txt-muted";

  return (
    <div className="border-b border-border/50">
      {/* Main row */}
      <div
        className="grid gap-3 px-5 py-3 items-center hover:bg-[#111] cursor-pointer transition-colors"
        style={{ gridTemplateColumns: "minmax(180px, 1.5fr) 100px 88px 100px 88px 110px 36px" }}
        onClick={onToggle}
      >
        {/* Token */}
        <div
          className="min-w-0 flex items-center gap-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChart();
          }}
        >
          <div className="w-[28px] h-[28px] rounded-full bg-[#161616] border border-border flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-mono font-bold">{t.symbol.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-white font-medium truncate flex items-center gap-1.5">
              {t.symbol}
              {isLive && <span className="w-[5px] h-[5px] rounded-full bg-positive" />}
            </div>
            <div className="text-[10px] text-txt-muted font-mono">
              OI {formatUSD(t.raw.openInterestUsd)}
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="text-right">
          <div className="font-mono text-[13px] text-white font-medium">${formatPrice(displayPrice)}</div>
          <div className="text-[9.5px] text-txt-muted font-mono">
            vol {formatUSD(t.raw.dayVolumeUsd)}
          </div>
        </div>

        {/* 24h change */}
        <div className={`text-right font-mono text-[12px] font-medium ${
          t.priceChange24hPct >= 0 ? "text-positive" : "text-negative"
        }`}>
          {t.priceChange24hPct >= 0 ? "+" : ""}{t.priceChange24hPct.toFixed(1)}%
        </div>

        {/* State badge */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] text-[10.5px] font-medium tracking-[0.01em]"
            style={{
              background: stateColor.bg,
              color: stateColor.fg,
              border: `1px solid ${stateColor.border}`,
            }}
          >
            <span className="w-[5px] h-[5px] rounded-full" style={{ background: stateColor.fg }} />
            {STATE_LABELS[t.state]}
          </span>
        </div>

        {/* Funding */}
        <div className={`text-right font-mono text-[12px] font-medium ${fundingColor}`}>
          {t.raw.fundingRate8h >= 0 ? "+" : ""}{t.raw.fundingRate8h.toFixed(3)}%
        </div>

        {/* Pressure bar + score */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[6px] bg-[#1C1C1C] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${score}%`,
                background: `linear-gradient(90deg, ${color}aa, ${color})`,
                boxShadow: `0 0 8px ${color}66`,
              }}
            />
          </div>
          <span className="font-mono text-[12px] font-medium tabular-nums" style={{ color }}>
            {score}
          </span>
        </div>

        {/* Expand chevron */}
        <div className="flex justify-center text-txt-muted">
          {isExpanded ? (
            <ChevronUp className="w-[14px] h-[14px]" />
          ) : (
            <ChevronDown className="w-[14px] h-[14px]" />
          )}
        </div>
      </div>

      {/* Expanded breakdown */}
      {isExpanded && (
        <div className="px-5 pb-4 pt-1 bg-[#0a0a0a]">
          <div className="bg-[#0A0A0A] border border-dashed border-border rounded-[10px] p-4">
            {/* Why */}
            <div className="text-[12.5px] text-white leading-[1.5] mb-4">
              {t.why}
            </div>

            {/* Breakdown bars */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BreakdownBar label="OI change" value={t.breakdown.oi} max={40} />
              <BreakdownBar label="Funding" value={t.breakdown.funding} max={20} />
              <BreakdownBar label="Momentum" value={t.breakdown.momentum} max={20} />
              <BreakdownBar label="OI / Vol" value={t.breakdown.oiVolume} max={20} />
            </div>

            <div className="mt-4 pt-3 border-t border-dashed border-border flex items-center justify-between">
              <div className="text-[10.5px] text-txt-muted font-mono">
                Mark ${formatPrice(t.raw.markPrice)} · Prev ${formatPrice(t.raw.prevDayPrice)} · OI/Vol {(t.raw.openInterestUsd / Math.max(1, t.raw.dayVolumeUsd)).toFixed(2)}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenChart(); }}
                className="text-[11px] font-medium text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-md px-2.5 py-1 transition-colors"
              >
                Open chart →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 65 ? "#10B981" : pct >= 35 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[10.5px] text-txt-muted">
        <span>{label}</span>
        <span className="font-mono text-white">{value}/{max}</span>
      </div>
      <div className="h-[3px] bg-[#1C1C1C] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
