// ═══════════════════════════════════════════════════════════════
// /api/scanner — v24
// Pure Hyperliquid perp markets + cached inline sparklines.
//
// Sparklines: ~179 markets × 1 candleSnapshot call each = expensive.
// We fetch them in batches of 20 parallel, hold in unstable_cache for 5 min.
// On a cache hit, the Scanner API responds in ~200ms with sparklines included.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchHLPerpMarkets, type HLPerpMarket } from "@/lib/api/hl-perps";
import { fetchSparkline24h } from "@/lib/api/hl-candles";

export const dynamic = "force-dynamic";
export const revalidate = 15;

const SPARKLINE_BATCH_SIZE = 20;
const SPARKLINE_CACHE_TTL = 300; // 5 minutes

// Fetch sparklines for all symbols in throttled batches.
// Returns { [symbol]: number[] } map of hourly closes.
async function fetchAllSparklines(symbols: string[]): Promise<Record<string, number[]>> {
  const result: Record<string, number[]> = {};

  for (let i = 0; i < symbols.length; i += SPARKLINE_BATCH_SIZE) {
    const batch = symbols.slice(i, i + SPARKLINE_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((sym) => fetchSparkline24h(sym)),
    );
    settled.forEach((r, idx) => {
      const sym = batch[idx];
      if (r.status === "fulfilled" && r.value.length > 0) {
        result[sym] = r.value.map((p) => p.price);
      } else {
        result[sym] = [];
      }
    });
  }

  return result;
}

// Cached wrapper — Next holds the result for 5 min across requests/instances.
const getCachedSparklines = unstable_cache(
  fetchAllSparklines,
  ["all-hl-sparklines-v1"],
  { revalidate: SPARKLINE_CACHE_TTL, tags: ["sparklines"] },
);

export async function GET() {
  try {
    const markets = await fetchHLPerpMarkets();

    // Default sort: highest 24h volume first
    markets.sort((a, b) => b.volume24hUsd - a.volume24hUsd);

    // Attach cached sparklines (only the top 100 by volume — that's what fits on screen)
    const topSymbols = markets.slice(0, 100).map((m) => m.symbol);
    const sparkMap = await getCachedSparklines(topSymbols).catch(() => ({} as Record<string, number[]>));

    const enriched: HLPerpMarket[] = markets.map((m) => ({
      ...m,
      sparkline24h: sparkMap[m.symbol] ?? [],
    }));

    return NextResponse.json({
      markets: enriched,
      count: enriched.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Scanner API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Hyperliquid markets", markets: [], count: 0 },
      { status: 500 },
    );
  }
}
