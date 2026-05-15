// ═══════════════════════════════════════════════════════════════
// /api/pressure
// Fetches all Hyperliquid perps + scores them for the Flow Pressure Map
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { scoreToken, type PerpRawData } from "@/lib/pressure/scoring";

export const dynamic = "force-dynamic";
export const revalidate = 30;

interface HLAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface HLAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
}

const HL_API = "https://api.hyperliquid.xyz/info";

export async function GET() {
  try {
    const res = await fetch(HL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      // Don't cache here — we want the freshest data
    });

    if (!res.ok) {
      throw new Error(`Hyperliquid ${res.status}: ${res.statusText}`);
    }

    const [meta, ctxs] = (await res.json()) as [{ universe: HLAssetMeta[] }, HLAssetCtx[]];

    const rawData: PerpRawData[] = [];
    meta.universe.forEach((asset, i) => {
      const ctx = ctxs[i];
      if (!ctx) return;

      const markPx = parseFloat(ctx.markPx);
      const prevDayPx = parseFloat(ctx.prevDayPx);
      const oiCoin = parseFloat(ctx.openInterest);
      const oiUsd = oiCoin * markPx;
      const fundingHourly = parseFloat(ctx.funding);
      const dayVol = parseFloat(ctx.dayNtlVlm);

      // Approximate OI 24h change using % price move
      // (Hyperliquid doesn't expose historical OI in this endpoint — would need a snapshot DB for true delta)
      // We use price change as a directional proxy with adjustment based on funding direction.
      // This isn't perfect, but it's directionally meaningful for the Pressure Map demo.
      const priceChangePct = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;
      // Use a weighted blend: price move * 0.8 + funding-sign-adjusted bonus
      const oiChangeApprox = priceChangePct * 0.8 + (fundingHourly > 0 ? 2 : -2);

      // Funding rate 8h: HL is hourly so multiply by 8, then express as percent
      const funding8h = fundingHourly * 8 * 100;

      // Filter out tokens with negligible activity (likely delisted or stale)
      if (oiUsd < 100_000 || dayVol < 10_000) return;

      rawData.push({
        symbol: asset.name.toUpperCase(),
        markPrice: markPx,
        prevDayPrice: prevDayPx,
        openInterestUsd: oiUsd,
        openInterestChange24hPct: oiChangeApprox,
        fundingRate8h: funding8h,
        dayVolumeUsd: dayVol,
      });
    });

    const scored = rawData.map(scoreToken);
    // Sort highest score first by default
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      tokens: scored,
      count: scored.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Pressure API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch pressure data", tokens: [] },
      { status: 500 }
    );
  }
}
