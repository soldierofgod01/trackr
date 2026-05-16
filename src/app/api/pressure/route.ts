// ═══════════════════════════════════════════════════════════════
// /api/pressure
// Fetches all Hyperliquid perps and returns:
//   - scored tokens (table/list view)
//   - classified setups by style (hero card view)
//   - market regime aggregate
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { scoreToken, type PerpRawData } from "@/lib/pressure/scoring";
import {
  classifySetup,
  detectRegime,
  inferPressureTrend,
  whyNow,
  buildSubScores,
} from "@/lib/pressure/setups";

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

    // Classify each into setups (any flavor) and return as a single ranked
    // list. The UI no longer segregates by setup style — just shows the
    // strongest signals across all setup types, weighted by confidence so
    // we don't over-promote low-confidence reversals over high-confidence trends.
    const confidenceWeight = { high: 1.2, medium: 1.0, low: 0.8 } as const;
    const signals = scored
      .map((s) => classifySetup(s))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => {
        const trend = inferPressureTrend(c.fitScore, c.score.raw, c.score.priceChange24hPct);
        const subScores = buildSubScores(c.score.raw, c.score.priceChange24hPct);
        const matters = whyNow(c.setupType, trend, c.score.raw, c.score.priceChange24hPct);
        return {
          ...c,
          composite: c.fitScore * confidenceWeight[c.plan.confidence],
          trend,
          whyNow: matters,
          subScores,
        };
      })
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 20);

    const regime = detectRegime(scored);

    return NextResponse.json({
      tokens: scored,
      count: scored.length,
      signals,
      regime,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Pressure API error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch pressure data",
        tokens: [],
        signals: [],
        regime: null,
      },
      { status: 500 }
    );
  }
}
