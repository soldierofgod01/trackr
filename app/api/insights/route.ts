// /api/insights — runs the Mako insight engine on live Hyperliquid markets.
// Returns interpreted setups ("what's happening + what it means"), not raw data.

import { NextResponse } from "next/server";
import { fetchHLPerpMarkets } from "@/lib/api/hl-perps";
import { generateInsights } from "@/lib/insights/insight-engine";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET() {
  try {
    const markets = await fetchHLPerpMarkets();
    const insights = generateInsights(markets, 8);
    return NextResponse.json({
      insights,
      count: insights.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Insights API error:", err);
    return NextResponse.json(
      { insights: [], count: 0, error: "failed" },
      { status: 500 },
    );
  }
}
