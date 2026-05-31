// ═══════════════════════════════════════════════════════════════
// /api/scanner — v19
// Pure Hyperliquid perp markets. One source. Every row has full data.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { fetchHLPerpMarkets } from "@/lib/api/hl-perps";

export const dynamic = "force-dynamic";
export const revalidate = 15;

export async function GET() {
  try {
    const markets = await fetchHLPerpMarkets();
    // Default sort: highest 24h volume first
    markets.sort((a, b) => b.volume24hUsd - a.volume24hUsd);

    return NextResponse.json({
      markets,
      count: markets.length,
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
