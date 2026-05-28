// /api/sparkline?symbol=BTC — returns 24h hourly close prices for a single market.
// Called on-demand when a Scanner row is expanded.

import { NextRequest, NextResponse } from "next/server";
import { fetchSparkline24h } from "@/lib/api/hl-candles";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required", points: [] }, { status: 400 });
  }

  const points = await fetchSparkline24h(symbol);
  return NextResponse.json({ symbol, points });
}
