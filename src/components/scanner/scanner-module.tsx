"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePriceStream } from "@/lib/hooks/use-price-stream";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import { MiniSparkline } from "@/components/scanner/mini-sparkline";
import type { HLPerpMarket } from "@/lib/api/hl-perps";
import type { SparklinePoint } from "@/lib/api/hl-candles";
import { ArrowUp, ArrowDown, ChevronDown, Search, X } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// Scanner v23 — Tier-2 catch-up:
//   • Search box (top-right)
//   • Click column header to sort (replaces the separate Sort row)
//   • Click any row to expand inline (sparkline + funding + chart button)
// Differentiator features (Pressure score column, whale dots) come in v24.
// ════════════════════════════════════════════════════════════════

interface ScannerResponse {
  markets: HLPerpMarket[];
  count: number;
  fetchedAt: string;
}

type ScreenId = "all" | "big_movers" | "oi_spike" | "high_funding" | "high_volume";
const SCREENS: { id: ScreenId; label: string }[] = [
  { id: "all", label: "All markets" },
  { id: "big_movers", label: "Big movers" },
  { id: "oi_spike", label: "High OI" },
  { id: "high_funding", label: "High funding" },
  { id: "high_volume", label: "High volume" },
];

// Column IDs used for click-to-sort
type SortKey = "price" | "change" | "oi" | "funding" | "volume" | "oiVol";
type SortDir = "asc" | "desc";

// ─── Format helpers ───
function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toExponential(2);
}
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

async function fetchScanner(): Promise<ScannerResponse> {
  const res = await fetch("/api/scanner");
  if (!res.ok) throw new Error("Failed to fetch scanner data");
  return res.json();
}

// Column grid template — single source of truth so header + rows + expanded all align
const COL_TEMPLATE = "minmax(160px,1.4fr) 120px 100px 130px 110px 120px 100px 32px";

export function ScannerModule() {
  const [screen, setScreen] = useState<ScreenId>("all");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["scanner-v19"],
    queryFn: fetchScanner,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const { prices: livePrices, status: wsStatus } = usePriceStream();
  const markets = useMemo(() => data?.markets ?? [], [data]);

  // Overlay live WS prices onto API data (display price only — never 24h%)
  const withLive = useMemo(() => {
    return markets.map((m) => {
      const live = livePrices[m.symbol];
      return live ? { ...m, markPrice: live.price } : m;
    });
  }, [markets, livePrices]);

  const filtered = useMemo(() => {
    let list = [...withLive];

    // Preset screen
    if (screen === "big_movers") {
      list = list.filter((m) => Math.abs(m.priceChange24hPct) >= 5);
    } else if (screen === "oi_spike") {
      list = list.filter((m) => m.openInterestUsd >= 5_000_000);
    } else if (screen === "high_funding") {
      list = list.filter((m) => Math.abs(m.fundingRate8h) >= 0.03);
    } else if (screen === "high_volume") {
      list = list.filter((m) => m.volume24hUsd >= 10_000_000);
    }

    // Search filter
    const q = search.trim().toUpperCase();
    if (q) {
      list = list.filter((m) => m.symbol.toUpperCase().includes(q));
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av = 0, bv = 0;
      switch (sortKey) {
        case "price":   av = a.markPrice; bv = b.markPrice; break;
        case "change":  av = a.priceChange24hPct; bv = b.priceChange24hPct; break;
        case "oi":      av = a.openInterestUsd; bv = b.openInterestUsd; break;
        case "funding": av = a.fundingRate8h; bv = b.fundingRate8h; break;
        case "volume":  av = a.volume24hUsd; bv = b.volume24hUsd; break;
        case "oiVol":   av = a.oiToVolumeRatio; bv = b.oiToVolumeRatio; break;
      }
      return (bv - av) * dir;
    });
    return list;
  }, [withLive, screen, search, sortKey, sortDir]);

  const totalVol = filtered.reduce((s, m) => s + m.volume24hUsd, 0);
  const totalOI = filtered.reduce((s, m) => s + m.openInterestUsd, 0);
  const secsAgo = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : 0;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-12 py-9 max-w-[1500px] mx-auto">
        {/* ─── Header ─── */}
        <div className="mb-6">
          <h1 className="ds-page-title">Scanner</h1>
          <p className="mt-2 text-[14px] text-txt-secondary leading-[1.5]">
            Every Hyperliquid perp market, live.
          </p>
        </div>

        {/* ─── Stat strip ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile label="Markets" value={isLoading ? "—" : filtered.length.toString()} />
          <StatTile label="Total volume 24h" value={isLoading ? "—" : fmtUsd(totalVol)} />
          <StatTile label="Total open interest" value={isLoading ? "—" : fmtUsd(totalOI)} />
          <StatTile
            label="Data"
            value={isError ? "Error" : isLoading ? "Loading" : "Live"}
            status={isError ? "warn" : isLoading ? "neutral" : "live"}
            sub={
              !isLoading && !isError
                ? `Hyperliquid · ${secsAgo}s ago${wsStatus === "live" ? " · streaming" : ""}`
                : undefined
            }
          />
        </div>

        {/* ─── Control row: screens (left) + search (right) ─── */}
        <div className="ds-panel mb-4 px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {SCREENS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScreen(s.id)}
                className={`px-3 h-8 rounded-[7px] text-[13px] font-medium transition-colors ${
                  screen === s.id
                    ? "bg-elevated text-txt-primary"
                    : "text-txt-muted hover:text-txt-primary hover:bg-elevated/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="ml-auto relative">
            <Search className="w-[14px] h-[14px] text-txt-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol…"
              className="h-8 w-[180px] pl-8 pr-8 bg-bg-base border border-border rounded-[7px] text-[13px] text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-border-strong"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
              >
                <X className="w-[14px] h-[14px]" />
              </button>
            )}
          </div>
        </div>

        {/* ─── Table ─── */}
        <div className="ds-panel overflow-hidden">
          {/* Column header — clickable for sort */}
          <div
            className="grid gap-4 px-5 h-11 items-center border-b border-border"
            style={{ gridTemplateColumns: COL_TEMPLATE }}
          >
            <span className="ds-label">Market</span>
            <SortHeader label="Price" id="price" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="24h" id="change" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="Open interest" id="oi" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="Funding 8h" id="funding" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="Volume 24h" id="volume" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="OI / Vol" id="oiVol" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <span />
          </div>

          {isError ? (
            <div className="py-20 text-center text-txt-muted text-[14px]">
              Couldn&rsquo;t reach Hyperliquid. Retrying…
            </div>
          ) : isLoading ? (
            <div className="py-20 text-center text-txt-muted text-[14px]">
              Loading Hyperliquid markets…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-txt-muted text-[14px]">
              {search ? `No markets matching "${search}"` : "No markets match this screen"}
            </div>
          ) : (
            filtered.map((m) => (
              <MarketRow
                key={m.symbol}
                market={m}
                isLive={!!livePrices[m.symbol]}
                expanded={expanded === m.symbol}
                onToggle={() => setExpanded(expanded === m.symbol ? null : m.symbol)}
                onOpenChart={() => setChartSymbol(m.symbol)}
              />
            ))
          )}
        </div>

        <div className="h-10" />
      </div>

      {chartSymbol && (
        <TradingViewModal symbol={chartSymbol} onClose={() => setChartSymbol(null)} />
      )}
    </div>
  );
}

// ─── Sortable column header ───
function SortHeader({
  label,
  id,
  sortKey,
  sortDir,
  onClick,
  align,
}: {
  label: string;
  id: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
  align: "left" | "right";
}) {
  const active = sortKey === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`ds-label flex items-center gap-1 hover:text-txt-primary transition-colors ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "text-txt-primary" : ""}`}
    >
      <span>{label}</span>
      {active && (
        sortDir === "desc"
          ? <ArrowDown className="w-3 h-3" />
          : <ArrowUp className="w-3 h-3" />
      )}
    </button>
  );
}

// ─── Stat tile ───
function StatTile({
  label, value, sub, status,
}: { label: string; value: string; sub?: string; status?: "live" | "warn" | "neutral" }) {
  const dot = status === "live" ? "#10B981" : status === "warn" ? "#F59E0B" : null;
  return (
    <div className="ds-panel px-4 py-3">
      <div className="ds-label mb-1.5">{label}</div>
      <div className="flex items-center gap-2">
        {dot && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
          />
        )}
        <span className="ds-num text-[18px] font-semibold text-txt-primary leading-none">
          {value}
        </span>
      </div>
      {sub && <div className="ds-num text-[11px] text-txt-muted mt-1">{sub}</div>}
    </div>
  );
}

// ─── Market row + expansion ───
function MarketRow({
  market: m,
  isLive,
  expanded,
  onToggle,
  onOpenChart,
}: {
  market: HLPerpMarket;
  isLive: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenChart: () => void;
}) {
  const up = m.priceChange24hPct >= 0;
  const changeColor = up ? "text-positive" : "text-negative";
  const fundingExtreme = Math.abs(m.fundingRate8h) >= 0.05;
  const fundingColor = fundingExtreme
    ? m.fundingRate8h > 0 ? "text-negative" : "text-positive"
    : "text-txt-secondary";

  return (
    <>
      <div
        onClick={onToggle}
        className={`grid gap-4 px-5 h-[52px] items-center border-b border-border hover:bg-elevated cursor-pointer transition-colors ${
          expanded ? "bg-elevated" : ""
        }`}
        style={{ gridTemplateColumns: COL_TEMPLATE }}
      >
        {/* Market */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center shrink-0">
            <span className="ds-num text-[11px] font-bold text-txt-secondary">
              {m.symbol.charAt(0)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold text-txt-primary truncate">
                {m.symbol}
              </span>
              {isLive && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-positive shrink-0"
                  title="Live price"
                />
              )}
            </div>
            <div className="ds-num text-[11px] text-txt-muted">{m.maxLeverage}x max</div>
          </div>
        </div>

        <div className="text-right ds-num text-[13.5px] font-medium text-txt-primary">
          ${fmtPrice(m.markPrice)}
        </div>

        <div className={`text-right ds-num text-[13px] font-medium flex items-center justify-end gap-1 ${changeColor}`}>
          {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {fmtPct(m.priceChange24hPct)}
        </div>

        <div className="text-right ds-num text-[13px] text-txt-primary">{fmtUsd(m.openInterestUsd)}</div>

        <div className={`text-right ds-num text-[13px] font-medium ${fundingColor}`}>
          {m.fundingRate8h >= 0 ? "+" : ""}{m.fundingRate8h.toFixed(4)}%
        </div>

        <div className="text-right ds-num text-[13px] text-txt-secondary">{fmtUsd(m.volume24hUsd)}</div>

        <div className="text-right ds-num text-[13px] text-txt-secondary">{m.oiToVolumeRatio.toFixed(2)}x</div>

        <div className="flex items-center justify-end">
          <ChevronDown
            className={`w-4 h-4 text-txt-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {expanded && <ExpandedRow symbol={m.symbol} positive={up} onOpenChart={onOpenChart} market={m} />}
    </>
  );
}

// ─── Expanded row ───
function ExpandedRow({
  symbol,
  positive,
  market,
  onOpenChart,
}: {
  symbol: string;
  positive: boolean;
  market: HLPerpMarket;
  onOpenChart: () => void;
}) {
  // On-demand sparkline fetch — only when expanded
  const { data: sparkData, isLoading } = useQuery({
    queryKey: ["sparkline", symbol],
    queryFn: async (): Promise<SparklinePoint[]> => {
      const res = await fetch(`/api/sparkline?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) return [];
      const j = await res.json();
      return j.points ?? [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="px-5 py-4 bg-bg-base border-b border-border">
      <div className="flex items-stretch gap-6 flex-wrap">
        {/* Sparkline */}
        <div className="flex flex-col gap-1.5">
          <div className="ds-label">24h trend</div>
          {isLoading ? (
            <div className="w-[320px] h-[60px] flex items-center text-txt-muted text-[11px]">
              Loading…
            </div>
          ) : (
            <MiniSparkline points={sparkData ?? []} positive={positive} />
          )}
        </div>

        {/* Funding detail */}
        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <div className="ds-label">Funding rate</div>
          <div className="ds-num text-[22px] font-semibold text-txt-primary leading-none">
            {market.fundingRate8h >= 0 ? "+" : ""}{market.fundingRate8h.toFixed(4)}%
          </div>
          <div className="ds-num text-[11px] text-txt-muted">
            per 8h · {market.fundingRateAnnualPct >= 0 ? "+" : ""}{market.fundingRateAnnualPct.toFixed(1)}% APR
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-1.5 min-w-[110px]">
          <div className="ds-label">OI / Volume</div>
          <div className="ds-num text-[22px] font-semibold text-txt-primary leading-none">
            {market.oiToVolumeRatio.toFixed(2)}x
          </div>
          <div className="ds-num text-[11px] text-txt-muted">
            {market.oiToVolumeRatio > 1.5 ? "Derivative-led" : market.oiToVolumeRatio > 0.5 ? "Balanced" : "Spot-led"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[100px]">
          <div className="ds-label">Max leverage</div>
          <div className="ds-num text-[22px] font-semibold text-txt-primary leading-none">
            {market.maxLeverage}x
          </div>
        </div>

        {/* Open full chart */}
        <div className="ml-auto flex items-end">
          <button
            onClick={onOpenChart}
            className="px-3 h-8 rounded-[7px] bg-elevated hover:bg-elevated-2 text-txt-primary text-[12.5px] font-medium border border-border transition-colors"
          >
            Open full chart
          </button>
        </div>
      </div>
    </div>
  );
}
