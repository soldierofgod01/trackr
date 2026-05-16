"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import { MOCK_SCANNER_TOKENS } from "@/lib/mock-data";
import type { ScannerToken } from "@/types";
import { Sparkline } from "@/components/ui/sparkline";
import { usePriceStream, type LivePrice } from "@/lib/hooks/use-price-stream";
import { TradingViewModal } from "@/components/charts/tradingview-modal";
import { ScannerHeatmap } from "@/components/scanner/scanner-heatmap";
import { Flame, Activity, TrendingUp, TrendingDown, Zap, Filter, Loader2, AlertCircle, LayoutGrid, Table as TableIcon } from "lucide-react";

const SCREENS = [
  { id: "all", label: "All tokens", icon: Filter, desc: "Top 50 by volume" },
  { id: "hot", label: "Hot now", icon: Flame, desc: "High volume + big 24h moves" },
  { id: "gainers", label: "Gainers", icon: TrendingUp, desc: "Biggest 24h gainers" },
  { id: "losers", label: "Losers", icon: TrendingDown, desc: "Biggest 24h losers" },
  { id: "perps", label: "Perps", icon: Activity, desc: "With active Hyperliquid perp" },
  { id: "high_funding", label: "High funding", icon: Zap, desc: "|funding 8h| above 0.03%" },
];

const CATEGORIES = ["all", "Major", "Alt L1", "Memecoin", "DeFi", "AI", "Infrastructure"];

const SORTS = [
  { id: "volume_24h", label: "Volume 24h" },
  { id: "price_change_24h", label: "24h %" },
  { id: "open_interest", label: "OI" },
  { id: "funding", label: "Funding" },
  { id: "marketcap", label: "Market cap" },
];

function formatUSD(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toExponential(2);
}

async function fetchScannerData(): Promise<ScannerToken[]> {
  const res = await fetch("/api/scanner");
  if (!res.ok) throw new Error("Failed to fetch scanner data");
  const data = await res.json();
  return data.tokens ?? [];
}

export function ScannerModule() {
  const {
    scannerScreen, setScannerScreen,
    scannerCategory, setScannerCategory,
    scannerSort, setScannerSort,
  } = useAppStore();

  // Symbol selected for the TradingView chart modal (null = closed)
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  // View mode toggle: 'table' (classic) or 'heatmap' (2.5D tile grid)
  const [viewMode, setViewMode] = useState<"table" | "heatmap">("table");

  // Live data via react-query — auto-refetches every 60s
  const { data: liveTokens, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["scanner"],
    queryFn: fetchScannerData,
    refetchInterval: 60_000,        // 60s — keeps us under CoinGecko free tier limits
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Real-time prices via Binance WebSocket (sub-second updates)
  const { prices: livePrices, status: wsStatus } = usePriceStream();

  // Use live data if available, fall back to mock during initial load
  const sourceTokens: ScannerToken[] = liveTokens && liveTokens.length > 0 ? liveTokens : MOCK_SCANNER_TOKENS;
  const isLive = !!(liveTokens && liveTokens.length > 0);

  // Overlay live WS prices on top of slower REST data
  const tokensWithLivePrices = useMemo(() => {
    return sourceTokens.map((t) => {
      const live = livePrices[t.symbol];
      if (live) {
        return {
          ...t,
          priceUsd: live.price,
          priceChange24h: live.change24hPct,
        };
      }
      return t;
    });
  }, [sourceTokens, livePrices]);

  const filtered = useMemo(() => {
    let t = [...tokensWithLivePrices];

    if (scannerScreen === "hot") {
      t = t.filter((x) => x.volume24h >= 50_000_000 && Math.abs(x.priceChange24h) >= 5);
    } else if (scannerScreen === "gainers") {
      t = t.filter((x) => x.priceChange24h > 0).sort((a, b) => b.priceChange24h - a.priceChange24h);
    } else if (scannerScreen === "losers") {
      t = t.filter((x) => x.priceChange24h < 0).sort((a, b) => a.priceChange24h - b.priceChange24h);
    } else if (scannerScreen === "perps") {
      t = t.filter((x) => x.openInterestUsd > 0);
    } else if (scannerScreen === "high_funding") {
      t = t.filter((x) => Math.abs(x.fundingRate8h) >= 0.03);
    }

    if (scannerCategory !== "all") {
      t = t.filter((x) => x.category === scannerCategory);
    }

    // Don't re-sort if screen already sorted
    if (scannerScreen !== "gainers" && scannerScreen !== "losers") {
      t.sort((a, b) => {
        switch (scannerSort) {
          case "volume_24h": return b.volume24h - a.volume24h;
          case "price_change_24h": return Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h);
          case "open_interest": return b.openInterestUsd - a.openInterestUsd;
          case "funding": return Math.abs(b.fundingRate8h) - Math.abs(a.fundingRate8h);
          case "marketcap": return b.marketCapUsd - a.marketCapUsd;
          default: return 0;
        }
      });
    }

    return t;
  }, [tokensWithLivePrices, scannerScreen, scannerCategory, scannerSort]);

  const totalVolume = filtered.reduce((s, m) => s + m.volume24h, 0);
  const totalOI = filtered.reduce((s, m) => s + m.openInterestUsd, 0);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const secsSinceUpdate = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 md:px-10 py-8 max-w-[1500px] mx-auto">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none">Scanner</h1>
            <div className="mt-[10px] flex items-center gap-[10px] text-[12.5px] text-txt-muted">
              <span>{filtered.length} tokens · {formatUSD(totalVolume)} vol · {formatUSD(totalOI)} OI</span>
              <span>·</span>
              <DataStatus isLive={isLive} isLoading={isLoading} isError={isError} isFetching={isFetching} secsSinceUpdate={secsSinceUpdate} wsStatus={wsStatus} liveCount={Object.keys(livePrices).length} />
            </div>
          </div>
        </div>

        {/* Screen pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {SCREENS.map((s) => {
            const Icon = s.icon;
            const active = scannerScreen === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setScannerScreen(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-[9px] text-[12px] font-medium transition-all whitespace-nowrap border ${
                  active
                    ? "bg-scanner/10 border-scanner/25 text-scanner"
                    : "bg-[#0A0A0A] border-border text-txt-secondary hover:text-txt-primary hover:border-border-strong"
                }`}
                title={s.desc}
              >
                <Icon className="w-[13px] h-[13px]" strokeWidth={2} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-5 mb-5 text-[11.5px] flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-txt-muted uppercase tracking-[0.08em] text-[10px] font-medium">Category:</span>
            <div className="flex gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setScannerCategory(c)}
                  className={`px-2.5 py-1 rounded-[6px] transition-colors ${
                    scannerCategory === c ? "bg-[#1C1C1C] text-txt-primary" : "text-txt-muted hover:text-txt-primary"
                  }`}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {/* View mode toggle: table / heatmap */}
            <div className="flex items-center gap-1 p-0.5 rounded-[7px] bg-[#0A0A0A] border border-border">
              <button
                onClick={() => setViewMode("table")}
                title="Table view"
                className={`flex items-center gap-1.5 px-2 py-1 rounded-[5px] text-[10.5px] font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-[#1C1C1C] text-txt-primary"
                    : "text-txt-muted hover:text-txt-primary"
                }`}
              >
                <TableIcon className="w-3 h-3" />
                Table
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                title="Heatmap view"
                className={`flex items-center gap-1.5 px-2 py-1 rounded-[5px] text-[10.5px] font-medium transition-colors ${
                  viewMode === "heatmap"
                    ? "bg-[#1C1C1C] text-txt-primary"
                    : "text-txt-muted hover:text-txt-primary"
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                Heatmap
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-txt-muted uppercase tracking-[0.08em] text-[10px] font-medium">Sort:</span>
              <div className="flex gap-1">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScannerSort(s.id)}
                    className={`px-2.5 py-1 rounded-[6px] transition-colors font-mono ${
                      scannerSort === s.id ? "bg-[#1C1C1C] text-txt-primary" : "text-txt-muted hover:text-txt-primary"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Either heatmap or table, controlled by viewMode toggle */}
        {viewMode === "heatmap" ? (
          <ScannerHeatmap tokens={filtered} onSelect={(sym) => setChartSymbol(sym)} />
        ) : (
        <div className="bg-[#0A0A0A] border border-border rounded-[13px] overflow-hidden">
          <div
            className="grid gap-3 px-5 py-3 border-b border-border text-[9.5px] text-txt-muted uppercase tracking-[0.08em] font-medium"
            style={{ gridTemplateColumns: "minmax(200px, 1.6fr) 110px 80px 72px 100px 110px 95px" }}
          >
            <span>Token</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span>Trend</span>
            <span className="text-right">Volume 24h</span>
            <span className="text-right">Open Int.</span>
            <span className="text-right">Funding 8h</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-txt-muted text-[13px]">
              {isLoading ? "Loading market data..." : "No tokens match these filters"}
            </div>
          ) : (
            filtered.map((t) => (
              <TokenRow
                key={t.symbol}
                token={t}
                livePrice={livePrices[t.symbol]}
                onClick={() => setChartSymbol(t.symbol)}
              />
            ))
          )}
        </div>
        )}

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

function DataStatus({
  isLive,
  isLoading,
  isError,
  isFetching,
  secsSinceUpdate,
  wsStatus,
  liveCount,
}: {
  isLive: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  secsSinceUpdate: number;
  wsStatus: "connecting" | "live" | "error";
  liveCount: number;
}) {
  if (isLoading) {
    return (
      <span className="font-mono text-[11px] text-txt-muted inline-flex items-center gap-1.5">
        <Loader2 className="w-[11px] h-[11px] animate-spin" />
        Loading live data
      </span>
    );
  }
  if (isError) {
    return (
      <span className="font-mono text-[11px] text-warning inline-flex items-center gap-1.5">
        <AlertCircle className="w-[11px] h-[11px]" />
        API error · showing samples
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="font-mono text-[11px] inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-[6px] h-[6px] rounded-full bg-positive animate-pulse" />
          <span className="text-positive">LIVE</span>
        </span>
        {wsStatus === "live" && liveCount > 0 && (
          <span className="text-txt-muted">· {liveCount} tickers streaming</span>
        )}
        <span className="text-txt-dim">· {secsSinceUpdate}s ago</span>
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-txt-muted inline-flex items-center gap-1.5">
      Sample data
    </span>
  );
}

function TokenRow({
  token: t,
  livePrice,
  onClick,
}: {
  token: ScannerToken;
  livePrice?: LivePrice;
  onClick?: () => void;
}) {
  const priceChangeColor =
    t.priceChange24h > 0 ? "text-positive" : t.priceChange24h < 0 ? "text-negative" : "text-txt-muted";
  const fundingColor =
    Math.abs(t.fundingRate8h) >= 0.05
      ? t.fundingRate8h > 0 ? "text-negative" : "text-positive"   // high positive = longs paying = bearish signal
      : "text-txt-muted";

  // Tick direction for flash
  const isLive = !!livePrice;
  const tickUp = isLive && livePrice.price > livePrice.prevPrice;
  const tickDown = isLive && livePrice.price < livePrice.prevPrice;
  // Use the live tick timestamp as a key — forces React to re-render and re-trigger the flash animation
  const flashKey = isLive ? `${livePrice.ts}-${livePrice.price}` : t.symbol;

  return (
    <div
      onClick={onClick}
      className="grid gap-3 px-5 py-3 items-center border-b border-border/50 hover:bg-[#111] cursor-pointer transition-colors"
      style={{ gridTemplateColumns: "minmax(200px, 1.6fr) 110px 80px 72px 100px 110px 95px" }}
    >
      <div className="min-w-0 flex items-center gap-[10px]">
        <div className="w-[28px] h-[28px] rounded-full bg-[#161616] border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
          {t.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.iconUrl} alt={t.symbol} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[11px] font-mono font-bold">{t.symbol.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] text-txt-primary font-medium truncate flex items-center gap-1.5">
            {t.symbol}
            {isLive && <span className="w-[5px] h-[5px] rounded-full bg-positive" title="Live price" />}
          </div>
          <div className="text-[10px] text-txt-muted font-mono uppercase tracking-[0.06em]">{t.category}</div>
        </div>
      </div>

      <div className="text-right">
        <div
          key={flashKey}
          className={`font-mono text-[13px] font-medium transition-colors ${
            tickUp ? "text-positive" : tickDown ? "text-negative" : "text-txt-primary"
          }`}
          style={{ animation: isLive && (tickUp || tickDown) ? "tickFade 600ms ease-out" : undefined }}
        >
          ${formatPrice(t.priceUsd)}
        </div>
        <div className="text-[9.5px] text-txt-muted font-mono">{formatUSD(t.marketCapUsd)} mcap</div>
      </div>

      <div className={`text-right font-mono text-[12px] font-medium ${priceChangeColor}`}>
        <div>{t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%</div>
        <div className="text-[9.5px] text-txt-muted">{t.priceChange7d >= 0 ? "+" : ""}{t.priceChange7d.toFixed(1)}% 7d</div>
      </div>

      <div>
        <Sparkline data={t.sparkline7d} positive={t.priceChange7d >= 0} />
      </div>

      <div className="text-right font-mono text-[12px] text-txt-secondary">{formatUSD(t.volume24h)}</div>

      {/* Open Interest */}
      <div className="text-right">
        {t.openInterestUsd > 0 ? (
          <>
            <div className="font-mono text-[12px] text-txt-primary font-medium">{formatUSD(t.openInterestUsd)}</div>
            <div className={`text-[9.5px] font-mono ${t.openInterestChange24h >= 0 ? "text-positive" : "text-negative"}`}>
              {t.openInterestChange24h >= 0 ? "+" : ""}{t.openInterestChange24h.toFixed(1)}%
            </div>
          </>
        ) : (
          <span className="text-txt-dim font-mono text-[11px]">—</span>
        )}
      </div>

      {/* Funding 8h */}
      <div className="text-right">
        {t.openInterestUsd > 0 ? (
          <span className={`font-mono text-[12px] font-medium ${fundingColor}`}>
            {t.fundingRate8h >= 0 ? "+" : ""}{t.fundingRate8h.toFixed(3)}%
          </span>
        ) : (
          <span className="text-txt-dim font-mono text-[11px]">—</span>
        )}
      </div>
    </div>
  );
}
