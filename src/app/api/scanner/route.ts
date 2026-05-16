// ═══════════════════════════════════════════════════════════════
// API route: /api/scanner
// Returns merged CoinGecko + Hyperliquid token data
// Cached for 30s server-side
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { fetchTopTokens } from "@/lib/api/coingecko";
import { fetchHyperliquidPerps } from "@/lib/api/hyperliquid";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  try {
    // Fetch both in parallel — saves ~500ms
    const [tokens, perpsMap] = await Promise.all([
      fetchTopTokens(250),
      fetchHyperliquidPerps().catch((err): Record<string, never> => {
        // If HL fails, return empty map — tokens still work, just no OI/funding
        console.error("Hyperliquid fetch failed:", err);
        return {};
      }),
    ]);

    // Merge perp data into tokens by symbol
    const merged = tokens.map((t) => {
      const perp = (perpsMap as Record<string, { openInterestUsd: number; openInterestChange24h: number; fundingRate8h: number } | undefined>)[t.symbol];
      if (perp) {
        return {
          ...t,
          openInterestUsd: perp.openInterestUsd,
          openInterestChange24h: perp.openInterestChange24h,
          fundingRate8h: perp.fundingRate8h,
        };
      }
      return t;  // spot-only tokens keep zeros
    });

    return NextResponse.json({
      tokens: merged,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Scanner API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch market data", tokens: [] },
      { status: 500 }
    );
  }
}
