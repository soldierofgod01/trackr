"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePriceStream } from "@/lib/hooks/use-price-stream";
import type { HLPerpMarket } from "@/lib/api/hl-perps";

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toExponential(2);
}

async function fetchMarkets(): Promise<HLPerpMarket[]> {
  const res = await fetch("/api/scanner");
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  return data.markets ?? [];
}

export function TickerBar() {
  const { data } = useQuery({
    queryKey: ["scanner-v19"],
    queryFn: fetchMarkets,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  const { prices: livePrices } = usePriceStream();

  // Top 16 HL markets by volume for the ticker
  const items = useMemo(() => {
    const source = data ?? [];
    return source.slice(0, 16).map((m) => {
      const live = livePrices[m.symbol];
      return {
        symbol: m.symbol,
        price: live ? live.price : m.markPrice,
        prevPrice: live ? live.prevPrice : m.markPrice,
        change24h: m.priceChange24hPct,
        live: !!live,
      };
    });
  }, [data, livePrices]);

  const renderItem = (
    t: { symbol: string; price: number; prevPrice: number; change24h: number; live: boolean },
    key: string,
  ) => {
    const arrow = t.change24h >= 0 ? "▲" : "▼";
    const pct = t.change24h >= 0 ? "+" : "";
    const flashColor =
      t.live && t.price > t.prevPrice ? "text-positive" :
      t.live && t.price < t.prevPrice ? "text-negative" : "text-txt-secondary";

    return (
      <span key={key} className="px-3 inline-flex items-center gap-1.5">
        <span className="text-txt-primary font-medium">{t.symbol}</span>
        <span className={`transition-colors ${flashColor}`}>${formatPrice(t.price)}</span>
        <span className={t.change24h >= 0 ? "text-positive" : "text-negative"}>
          {arrow} {pct}{t.change24h.toFixed(1)}%
        </span>
        <span className="text-txt-dim">·</span>
      </span>
    );
  };

  if (items.length === 0) {
    return (
      <div className="h-8 border-t border-border bg-surface-0 flex items-center sticky bottom-0 z-50" />
    );
  }

  return (
    <div className="h-8 border-t border-border bg-surface-0 overflow-hidden flex items-center sticky bottom-0 z-50">
      <div className="flex whitespace-nowrap animate-ticker text-2xs font-mono">
        <span>{items.map((t, i) => renderItem(t, `a-${t.symbol}-${i}`))}</span>
        <span>{items.map((t, i) => renderItem(t, `b-${t.symbol}-${i}`))}</span>
      </div>
    </div>
  );
}
