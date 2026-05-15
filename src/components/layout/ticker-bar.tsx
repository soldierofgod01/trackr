"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { MOCK_SCANNER_TOKENS } from "@/lib/mock-data";
import type { ScannerToken } from "@/types";
import { usePriceStream } from "@/lib/hooks/use-price-stream";

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toExponential(2);
}

async function fetchScannerData(): Promise<ScannerToken[]> {
  const res = await fetch("/api/scanner");
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  return data.tokens ?? [];
}

export function TickerBar() {
  // Slow data (market cap, volume, icon) from CoinGecko via /api/scanner
  const { data } = useQuery({
    queryKey: ["scanner"],
    queryFn: fetchScannerData,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Fast prices from Binance WebSocket
  const { prices: livePrices } = usePriceStream();

  const source = data && data.length > 0 ? data : MOCK_SCANNER_TOKENS;

  // Overlay live prices onto the slow data
  const items = useMemo(() => {
    return source.slice(0, 16).map((t) => {
      const live = livePrices[t.symbol];
      if (live) {
        return {
          ...t,
          priceUsd: live.price,
          priceChange24h: live.change24hPct,
          _live: true,
          _prevPrice: live.prevPrice,
        };
      }
      return { ...t, _live: false, _prevPrice: t.priceUsd };
    });
  }, [source, livePrices]);

  const renderItem = (
    t: ScannerToken & { _live: boolean; _prevPrice: number },
    key: string
  ) => {
    const arrow = t.priceChange24h >= 0 ? "▲" : "▼";
    const pct = t.priceChange24h >= 0 ? "+" : "";
    const flashColor =
      t._live && t.priceUsd > t._prevPrice ? "text-positive" :
      t._live && t.priceUsd < t._prevPrice ? "text-negative" : "text-txt-secondary";

    return (
      <span key={key} className="px-3 inline-flex items-center gap-1.5">
        <span className="text-txt-primary font-medium">{t.symbol}</span>
        <span className={`transition-colors ${flashColor}`}>${formatPrice(t.priceUsd)}</span>
        <span className={t.priceChange24h >= 0 ? "text-positive" : "text-negative"}>
          {arrow} {pct}{t.priceChange24h.toFixed(1)}%
        </span>
        <span className="text-txt-dim">·</span>
      </span>
    );
  };

  return (
    <div className="h-8 border-t border-border bg-surface-0 overflow-hidden flex items-center sticky bottom-0 z-50">
      <div className="flex whitespace-nowrap animate-ticker text-2xs font-mono">
        <span>{items.map((t, i) => renderItem(t, `a-${t.symbol}-${i}`))}</span>
        <span>{items.map((t, i) => renderItem(t, `b-${t.symbol}-${i}`))}</span>
      </div>
    </div>
  );
}
