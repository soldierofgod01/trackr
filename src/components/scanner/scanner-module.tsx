"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePriceStream } from "@/lib/hooks/use-price-stream";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import type { HLPerpMarket } from "@/lib/api/hl-perps";
import { ArrowUp, ArrowDown } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// Scanner v19 — pure Hyperliquid perp screener.
// Column set inspired by Orion Terminal; calm dark styling from Velo.
// Single control row. Every row has full data (no "—" gaps, no junk tokens).
// ════════════════════════════════════════════════════════════════

interface ScannerResponse {
  markets: HLPerpMarket[];
  count: number;
  fetchedAt: string;
}

// ─── Preset screens (Orion-style trade-intent tabs, not spot categories) ───
type ScreenId = "all" | "big_movers" | "oi_spike" | "high_funding" | "high_volume";
const SCREENS: { id: ScreenId; label: string }[] = [
  { id: "all", label: "All markets" },
  { id: "big_movers", label: "Big movers" },
  { id: "oi_spike", label: "High OI" },
  { id: "high_funding", label: "High funding" },
  { id: "high_volume", label: "High volume" },
];

// ─── Sort options (all real HL data — no market cap) ───
type SortId = "volume" | "change" | "oi" | "funding";
const SORTS: { id: SortId; label: string }[] = [
  { id: "volume", label: "Volume" },
  { id: "change", label: "24h %" },
  { id: "oi", label: "Open interest" },
  { id: "funding", label: "Funding" },
];

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

export function ScannerModule() {
  const [screen, setScreen] = useState<ScreenId>("all");
  const [sort, setSort] = useState<SortId>("volume");
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["scanner-v19"],
    queryFn: fetchScanner,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const { prices: livePrices, status: wsStatus } = usePriceStream();

  const markets = useMemo(() => data?.markets ?? [], [data]);

  // Overlay live WS prices onto the HL data (display price only — never 24h%)
  const withLive = useMemo(() => {
    return markets.map((m) => {
      const live = livePrices[m.symbol];
      return live ? { ...m, markPrice: live.price } : m;
    });
  }, [markets, livePrices]);

  const filtered = useMemo(() => {
    let list = [...withLive];

    // Apply preset screen
    if (screen === "big_movers") {
      list = list.filter((m) => Math.abs(m.priceChange24hPct) >= 5);
    } else if (screen === "oi_spike") {
      list = list.filter((m) => m.openInterestUsd >= 5_000_000);
    } else if (screen === "high_funding") {
      list = list.filter((m) => Math.abs(m.fundingRate8h) >= 0.03);
    } else if (screen === "high_volume") {
      list = list.filter((m) => m.volume24hUsd >= 10_000_000);
    }

    // Apply sort (always after filter — fixes the v18 "not in order" bug)
    list.sort((a, b) => {
      switch (sort) {
        case "volume": return b.volume24hUsd - a.volume24hUsd;
        case "change": return b.priceChange24hPct - a.priceChange24hPct;
        case "oi": return b.openInterestUsd - a.openInterestUsd;
        case "funding": return Math.abs(b.fundingRate8h) - Math.abs(a.fundingRate8h);
        default: return 0;
      }
    });
    return list;
  }, [withLive, screen, sort]);

  const totalVol = filtered.reduce((s, m) => s + m.volume24hUsd, 0);
  const totalOI = filtered.reduce((s, m) => s + m.openInterestUsd, 0);
  const secsAgo = dataUpdatedAt
    ? Math.floor((Date.now() - dataUpdatedAt) / 1000)
    : 0;

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

        {/* ─── Single control row ─── */}
        <div className="ds-panel mb-4 px-4 py-3 flex items-center gap-4 flex-wrap">
          {/* Screens */}
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

          {/* Sort — folded into the same row, right-aligned */}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <span className="ds-label mr-1">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`px-2.5 h-7 rounded-[6px] text-[12.5px] font-medium transition-colors ${
                  sort === s.id
                    ? "bg-elevated text-txt-primary"
                    : "text-txt-muted hover:text-txt-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Table ─── */}
        <div className="ds-panel overflow-hidden">
          {/* Column header */}
          <div
            className="grid gap-4 px-5 h-11 items-center border-b border-border"
            style={{
              gridTemplateColumns:
                "minmax(150px,1.4fr) 130px 100px 130px 110px 120px 110px",
            }}
          >
            <span className="ds-label">Market</span>
            <span className="ds-label text-right">Price</span>
            <span className="ds-label text-right">24h</span>
            <span className="ds-label text-right">Open interest</span>
            <span className="ds-label text-right">Funding 8h</span>
            <span className="ds-label text-right">Volume 24h</span>
            <span className="ds-label text-right">OI / Vol</span>
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
              No markets match this screen
            </div>
          ) : (
            filtered.map((m) => (
              <MarketRow
                key={m.symbol}
                market={m}
                isLive={!!livePrices[m.symbol]}
                onClick={() => setChartSymbol(m.symbol)}
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

// ─── Stat tile ───
function StatTile({
  label,
  value,
  sub,
  status,
}: {
  label: string;
  value: string;
  sub?: string;
  status?: "live" | "warn" | "neutral";
}) {
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

// ─── Market row ───
function MarketRow({
  market: m,
  isLive,
  onClick,
}: {
  market: HLPerpMarket;
  isLive: boolean;
  onClick: () => void;
}) {
  const up = m.priceChange24hPct >= 0;
  const changeColor = up ? "text-positive" : "text-negative";

  // Funding: colored only when extreme. Positive extreme funding = longs paying.
  const fundingExtreme = Math.abs(m.fundingRate8h) >= 0.05;
  const fundingColor = fundingExtreme
    ? m.fundingRate8h > 0
      ? "text-negative"
      : "text-positive"
    : "text-txt-secondary";

  return (
    <div
      onClick={onClick}
      className="grid gap-4 px-5 h-[52px] items-center border-b border-border last:border-0 hover:bg-elevated cursor-pointer transition-colors"
      style={{
        gridTemplateColumns:
          "minmax(150px,1.4fr) 130px 100px 130px 110px 120px 110px",
      }}
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
          <div className="ds-num text-[11px] text-txt-muted">
            {m.maxLeverage}x max
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="text-right ds-num text-[13.5px] font-medium text-txt-primary">
        ${fmtPrice(m.markPrice)}
      </div>

      {/* 24h change */}
      <div className={`text-right ds-num text-[13px] font-medium flex items-center justify-end gap-1 ${changeColor}`}>
        {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {fmtPct(m.priceChange24hPct)}
      </div>

      {/* Open interest */}
      <div className="text-right ds-num text-[13px] text-txt-primary">
        {fmtUsd(m.openInterestUsd)}
      </div>

      {/* Funding 8h */}
      <div className={`text-right ds-num text-[13px] font-medium ${fundingColor}`}>
        {m.fundingRate8h >= 0 ? "+" : ""}
        {m.fundingRate8h.toFixed(4)}%
      </div>

      {/* Volume 24h */}
      <div className="text-right ds-num text-[13px] text-txt-secondary">
        {fmtUsd(m.volume24hUsd)}
      </div>

      {/* OI / Volume ratio */}
      <div className="text-right ds-num text-[13px] text-txt-secondary">
        {m.oiToVolumeRatio.toFixed(2)}x
      </div>
    </div>
  );
}
