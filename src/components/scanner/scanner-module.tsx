"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/stores/app-store";
import { MOCK_SCANNER_TOKENS } from "@/lib/mock-data";
import type { ScannerToken } from "@/types";
import { Sparkline } from "@/components/ui/sparkline";
import { usePriceStream, type LivePrice } from "@/lib/hooks/use-price-stream";
import { TradingViewModal } from "@/components/charts/tradingview-modal";

// ════════════════════════════════════════════════════════════════
// Scanner — rebuilt on the v16 design system.
// Linear density × Vercel polish: warm-dark surfaces, 3 text levels,
// sentence-case labels, generous row height, color only for data.
// ════════════════════════════════════════════════════════════════

const SCREENS = [
  { id: "all", label: "All tokens" },
  { id: "hot", label: "Hot" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "perps", label: "Perps" },
  { id: "high_funding", label: "High funding" },
];

const CATEGORIES = ["all", "Major", "Alt L1", "Memecoin", "DeFi", "AI", "Infrastructure"];

const SORTS = [
  { id: "volume_24h", label: "Volume" },
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
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
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

  const [chartSymbol, setChartSymbol] = useState<string | null>(null);

  const { data: liveTokens, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["scanner"],
    queryFn: fetchScannerData,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { prices: livePrices, status: wsStatus } = usePriceStream();

  const sourceTokens: ScannerToken[] =
    liveTokens && liveTokens.length > 0 ? liveTokens : MOCK_SCANNER_TOKENS;
  const isLive = !!(liveTokens && liveTokens.length > 0);

  const tokensWithLivePrices = useMemo(() => {
    return sourceTokens.map((t) => {
      const live = livePrices[t.symbol];
      if (live) {
        return { ...t, priceUsd: live.price, priceChange24h: live.change24hPct };
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
  const secsSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-12 py-9 max-w-[1440px] mx-auto">
        {/* ─── Page header ─── */}
        <div className="mb-7">
          <h1 className="ds-page-title">Scanner</h1>
          <p className="mt-2 text-[14px] text-txt-secondary leading-[1.5]">
            Every liquid market, filtered the way you trade.
          </p>
        </div>

        {/* ─── Stat strip ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          <StatTile label="Tokens" value={filtered.length.toString()} />
          <StatTile label="Total volume 24h" value={formatUSD(totalVolume)} />
          <StatTile label="Total open interest" value={formatUSD(totalOI)} />
          <StatTile
            label="Data"
            value={
              isLoading
                ? "Loading"
                : isError
                ? "Sample"
                : isLive
                ? "Live"
                : "Sample"
            }
            status={isError ? "warn" : isLive && !isLoading ? "live" : "neutral"}
            sub={
              isLive && !isLoading
                ? `${secsSinceUpdate}s ago${wsStatus === "live" ? " · streaming" : ""}`
                : undefined
            }
          />
        </div>

        {/* ─── Controls bar ─── */}
        <div className="ds-panel mb-4 px-4 py-3 flex flex-col gap-3">
          {/* Row 1: screen segmented control */}
          <div className="flex items-center gap-1 flex-wrap">
            {SCREENS.map((s) => {
              const active = scannerScreen === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setScannerScreen(s.id)}
                  className={`px-3 h-8 rounded-[7px] text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-elevated text-txt-primary"
                      : "text-txt-muted hover:text-txt-primary hover:bg-elevated/50"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-border" />

          {/* Row 2: category (left) + sort (right) */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="ds-label mr-1">Category</span>
              {CATEGORIES.map((c) => {
                const active = scannerCategory === c;
                return (
                  <button
                    key={c}
                    onClick={() => setScannerCategory(c)}
                    className={`px-2.5 h-7 rounded-[6px] text-[12.5px] font-medium transition-colors ${
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-txt-muted hover:text-txt-primary"
                    }`}
                  >
                    {c === "all" ? "All" : c}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <span className="ds-label mr-1">Sort</span>
              {SORTS.map((s) => {
                const active = scannerSort === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setScannerSort(s.id)}
                    className={`px-2.5 h-7 rounded-[6px] text-[12.5px] font-medium transition-colors ${
                      active
                        ? "bg-elevated text-txt-primary"
                        : "text-txt-muted hover:text-txt-primary"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Table ─── */}
        <div className="ds-panel overflow-hidden">
          {/* Column header */}
          <div
            className="grid gap-4 px-5 h-11 items-center border-b border-border"
            style={{
              gridTemplateColumns:
                "minmax(180px, 1.5fr) 120px 90px 90px 110px 120px 100px",
            }}
          >
            <span className="ds-label">Token</span>
            <span className="ds-label text-right">Price</span>
            <span className="ds-label text-right">24h</span>
            <span className="ds-label">7d trend</span>
            <span className="ds-label text-right">Volume</span>
            <span className="ds-label text-right">Open interest</span>
            <span className="ds-label text-right">Funding</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-20 text-center text-txt-muted text-[14px]">
              {isLoading ? "Loading market data…" : "No tokens match these filters"}
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
  const dot =
    status === "live" ? "#10B981" : status === "warn" ? "#F59E0B" : null;
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

// ─── Token row ───

function TokenRow({
  token: t,
  livePrice,
  onClick,
}: {
  token: ScannerToken;
  livePrice?: LivePrice;
  onClick?: () => void;
}) {
  const isUp = t.priceChange24h > 0;
  const isDown = t.priceChange24h < 0;
  const priceChangeColor = isUp
    ? "text-positive"
    : isDown
    ? "text-negative"
    : "text-txt-muted";

  // High funding gets colored (longs paying = potential reversal signal)
  const fundingExtreme = Math.abs(t.fundingRate8h) >= 0.05;
  const fundingColor = fundingExtreme
    ? t.fundingRate8h > 0
      ? "text-negative"
      : "text-positive"
    : "text-txt-secondary";

  const isLive = !!livePrice;
  const tickUp = isLive && livePrice!.price > livePrice!.prevPrice;
  const tickDown = isLive && livePrice!.price < livePrice!.prevPrice;

  return (
    <div
      onClick={onClick}
      className="grid gap-4 px-5 h-[52px] items-center border-b border-border last:border-0 hover:bg-elevated cursor-pointer transition-colors"
      style={{
        gridTemplateColumns:
          "minmax(180px, 1.5fr) 120px 90px 90px 110px 120px 100px",
      }}
    >
      {/* Token */}
      <div className="min-w-0 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {t.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.iconUrl} alt={t.symbol} className="w-full h-full object-cover" />
          ) : (
            <span className="ds-num text-[11px] font-bold text-txt-secondary">
              {t.symbol.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold text-txt-primary truncate">
              {t.symbol}
            </span>
            {isLive && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-positive shrink-0"
                title="Live price"
              />
            )}
          </div>
          <div className="text-[11.5px] text-txt-muted truncate">{t.category}</div>
        </div>
      </div>

      {/* Price */}
      <div className="text-right">
        <div
          className={`ds-num text-[13.5px] font-medium transition-colors ${
            tickUp ? "text-positive" : tickDown ? "text-negative" : "text-txt-primary"
          }`}
        >
          ${formatPrice(t.priceUsd)}
        </div>
        <div className="ds-num text-[11px] text-txt-muted">
          {formatUSD(t.marketCapUsd)}
        </div>
      </div>

      {/* 24h */}
      <div className={`text-right ds-num text-[13px] font-medium ${priceChangeColor}`}>
        {t.priceChange24h >= 0 ? "+" : ""}
        {t.priceChange24h.toFixed(1)}%
      </div>

      {/* 7d trend sparkline */}
      <div className="flex justify-start">
        <Sparkline data={t.sparkline7d} positive={t.priceChange7d >= 0} />
      </div>

      {/* Volume */}
      <div className="text-right ds-num text-[13px] text-txt-secondary">
        {formatUSD(t.volume24h)}
      </div>

      {/* Open interest */}
      <div className="text-right">
        {t.openInterestUsd > 0 ? (
          <>
            <div className="ds-num text-[13px] text-txt-primary font-medium">
              {formatUSD(t.openInterestUsd)}
            </div>
            <div
              className={`ds-num text-[11px] ${
                t.openInterestChange24h >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {t.openInterestChange24h >= 0 ? "+" : ""}
              {t.openInterestChange24h.toFixed(1)}%
            </div>
          </>
        ) : (
          <span className="ds-num text-[12px] text-txt-dim">—</span>
        )}
      </div>

      {/* Funding */}
      <div className="text-right">
        {t.openInterestUsd > 0 ? (
          <span className={`ds-num text-[13px] font-medium ${fundingColor}`}>
            {t.fundingRate8h >= 0 ? "+" : ""}
            {t.fundingRate8h.toFixed(3)}%
          </span>
        ) : (
          <span className="ds-num text-[12px] text-txt-dim">—</span>
        )}
      </div>
    </div>
  );
}
