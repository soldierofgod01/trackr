// ═══════════════════════════════════════════════════════════════
// /api/pressure
// Fetches all Hyperliquid perps and returns:
//   - scored tokens (table/list view)
//   - classified setups by style (hero card view)
//   - market regime aggregate
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { scoreToken, type PerpRawData } from "@/lib/pressure/scoring";
import { classifySetup, detectRegime } from "@/lib/pressure/setups";

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

      // Approximate OI 24h change using price move + funding-direction blend.
      // (Hyperliquid doesn't expose historical OI here — would need a snapshot
      // DB for true delta. We approximate directionally.)
      const priceChangePct = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;
      const oiChangeApprox = priceChangePct * 0.8 + (fundingHourly > 0 ? 2 : -2);
      const funding8h = fundingHourly * 8 * 100;

      // Filter out negligible activity (delisted or stale)
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
    scored.sort((a, b) => b.score - a.score);

    // Classify each into setups; bucket by setup type
    const allCandidates = scored
      .map((s) => classifySetup(s))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.fitScore - a.fitScore);

    const setupsByType = {
      squeeze: allCandidates.filter((c) => c.setupType === "squeeze").slice(0, 8),
      trend: allCandidates.filter((c) => c.setupType === "trend").slice(0, 8),
      reversal: allCandidates.filter((c) => c.setupType === "reversal").slice(0, 8),
    };

    const regime = detectRegime(scored);

    return NextResponse.json({
      tokens: scored,
      count: scored.length,
      setups: setupsByType,
      regime,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Pressure API error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch pressure data",
        tokens: [],
        setups: { squeeze: [], trend: [], reversal: [] },
        regime: null,
      },
      { status: 500 }
    );
  }
}
