"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePriceStream } from "@/lib/hooks/use-price-stream";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import { InlineSparkline } from "@/components/scanner/inline-sparkline";
import type { HLPerpMarket } from "@/lib/api/hl-perps";
import { ArrowUp, ArrowDown, ChevronDown, Search, X } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// Scanner v24:
//   • Inline sparkline column on every row (server-batched, 5-min cache)
//   • "Live" data tile removed (3 stat tiles instead of 4)
//   • Preset screens replaced with directional filter toggles (↑/↓/both)
//   • Sparkline removed from expanded row (now in column)
// ════════════════════════════════════════════════════════════════

interface ScannerResponse {
  markets: HLPerpMarket[];
  count: number;
  fetchedAt: string;
}

type SortKey = "price" | "change" | "oi" | "funding" | "volume" | "oiVol";
type SortDir = "asc" | "desc";
type Direction = "both" | "up" | "down";

// Filter dimensions — replace preset screens with directional toggles
interface DirFilters {
  change: Direction;   // 24h % gainers / losers / both
  oi: Direction;       // high OI on/off (down = no filter, treated same as both for this one)
  funding: Direction;  // positive / negative / both
  volume: Direction;   // high volume on/off
}

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

// Column grid template — single source of truth so header + rows align
// Market | Price | 24h | 24h trend | OI | Funding | Vol | OI/Vol | chevron
const COL_TEMPLATE = "minmax(150px,1.3fr) 110px 95px 110px 120px 105px 115px 90px 32px";

export function ScannerModule() {
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const [filters, setFilters] = useState<DirFilters>({
    change: "both",
    oi: "both",
    funding: "both",
    volume: "both",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["scanner-v19"],
    queryFn: fetchScanner,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const { prices: livePrices } = usePriceStream();
  const markets = useMemo(() => data?.markets ?? [], [data]);

  // Overlay live WS prices onto API data (display price only)
  const withLive = useMemo(() => {
    return markets.map((m) => {
      const live = livePrices[m.symbol];
      return live ? { ...m, markPrice: live.price } : m;
    });
  }, [markets, livePrices]);

  const filtered = useMemo(() => {
    let list = [...withLive];

    // Directional filters
    if (filters.change === "up") list = list.filter((m) => m.priceChange24hPct > 0);
    else if (filters.change === "down") list = list.filter((m) => m.priceChange24hPct < 0);

    if (filters.funding === "up") list = list.filter((m) => m.fundingRate8h > 0);
    else if (filters.funding === "down") list = list.filter((m) => m.fundingRate8h < 0);

    // For OI and volume, "up" = above a threshold (active markets), "down" = below
    if (filters.oi === "up") list = list.filter((m) => m.openInterestUsd >= 5_000_000);
    else if (filters.oi === "down") list = list.filter((m) => m.openInterestUsd < 5_000_000);

    if (filters.volume === "up") list = list.filter((m) => m.volume24hUsd >= 10_000_000);
    else if (filters.volume === "down") list = list.filter((m) => m.volume24hUsd < 10_000_000);

    // Search
    const q = search.trim().toUpperCase();
    if (q) list = list.filter((m) => m.symbol.toUpperCase().includes(q));

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
  }, [withLive, filters, search, sortKey, sortDir]);

  const totalVol = filtered.reduce((s, m) => s + m.volume24hUsd, 0);
  const totalOI = filtered.reduce((s, m) => s + m.openInterestUsd, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const cycleFilter = (dim: keyof DirFilters) => {
    setFilters((f) => {
      const order: Direction[] = ["both", "up", "down"];
      const next = order[(order.indexOf(f[dim]) + 1) % 3];
      return { ...f, [dim]: next };
    });
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

        {/* ─── Stat strip (3 tiles, "Live" removed in v24) ─── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatTile label="Markets" value={isLoading ? "—" : filtered.length.toString()} />
          <StatTile label="Total volume 24h" value={isLoading ? "—" : fmtUsd(totalVol)} />
          <StatTile label="Total open interest" value={isLoading ? "—" : fmtUsd(totalOI)} />
        </div>

        {/* ─── Control row: directional filters + search ─── */}
        <div className="ds-panel mb-4 px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="ds-label mr-1">Filter</span>
          <DirToggle label="24h move"  value={filters.change} onClick={() => cycleFilter("change")} />
          <DirToggle label="Volume"    value={filters.volume} onClick={() => cycleFilter("volume")} />
          <DirToggle label="Open int." value={filters.oi}     onClick={() => cycleFilter("oi")} />
          <DirToggle label="Funding"   value={filters.funding} onClick={() => cycleFilter("funding")} />

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
          {/* Column header */}
          <div
            className="grid gap-4 px-5 h-11 items-center border-b border-border"
            style={{ gridTemplateColumns: COL_TEMPLATE }}
          >
            <span className="ds-label">Market</span>
            <SortHeader label="Price"      id="price"   sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="24h"        id="change"  sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <span className="ds-label">24h trend</span>
            <SortHeader label="Open int."  id="oi"      sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="Funding"    id="funding" sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="Volume"     id="volume"  sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
            <SortHeader label="OI / Vol"   id="oiVol"   sortKey={sortKey} sortDir={sortDir} onClick={handleSort} align="right" />
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
              {search ? `No markets matching "${search}"` : "No markets match these filters"}
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

// ─── Directional filter toggle ───
function DirToggle({
  label,
  value,
  onClick,
}: {
  label: string;
  value: Direction;
  onClick: () => void;
}) {
  const icon =
    value === "up"   ? <ArrowUp   className="w-3 h-3 text-positive" /> :
    value === "down" ? <ArrowDown className="w-3 h-3 text-negative" /> :
    null;

  const active = value !== "both";

  return (
    <button
      onClick={onClick}
      className={`px-2.5 h-8 rounded-[7px] text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
        active
          ? "bg-elevated text-txt-primary"
          : "text-txt-muted hover:text-txt-primary hover:bg-elevated/50"
      }`}
      title={`Click to cycle: any → up → down → any`}
    >
      <span>{label}</span>
      {icon}
    </button>
  );
}

// ─── Sortable column header ───
function SortHeader({
  label, id, sortKey, sortDir, onClick, align,
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
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="ds-panel px-4 py-3">
      <div className="ds-label mb-1.5">{label}</div>
      <span className="ds-num text-[18px] font-semibold text-txt-primary leading-none">
        {value}
      </span>
    </div>
  );
}

// ─── Market row ───
function MarketRow({
  market: m, isLive, expanded, onToggle, onOpenChart,
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

        {/* Inline sparkline column */}
        <div className="flex items-center">
          <InlineSparkline prices={m.sparkline24h} positive={up} />
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

      {expanded && <ExpandedRow market={m} onOpenChart={onOpenChart} />}
    </>
  );
}

// ─── Expanded row (sparkline removed in v24 — now in column) ───
function ExpandedRow({
  market,
  onOpenChart,
}: {
  market: HLPerpMarket;
  onOpenChart: () => void;
}) {
  return (
    <div className="px-5 py-4 bg-bg-base border-b border-border">
      <div className="flex items-stretch gap-6 flex-wrap">
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          <div className="ds-label">Funding rate</div>
          <div className="ds-num text-[22px] font-semibold text-txt-primary leading-none">
            {market.fundingRate8h >= 0 ? "+" : ""}{market.fundingRate8h.toFixed(4)}%
          </div>
          <div className="ds-num text-[11px] text-txt-muted">
            per 8h · {market.fundingRateAnnualPct >= 0 ? "+" : ""}{market.fundingRateAnnualPct.toFixed(1)}% APR
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[130px]">
          <div className="ds-label">OI / Volume</div>
          <div className="ds-num text-[22px] font-semibold text-txt-primary leading-none">
            {market.oiToVolumeRatio.toFixed(2)}x
          </div>
          <div className="ds-num text-[11px] text-txt-muted">
            {market.oiToVolumeRatio > 1.5 ? "Derivative-led" : market.oiToVolumeRatio > 0.5 ? "Balanced" : "Spot-led"}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[110px]">
          <div className="ds-label">Max leverage</div>
          <div className="ds-num text-[22px] font-semibold text-txt-primary leading-none">
            {market.maxLeverage}x
          </div>
        </div>

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
