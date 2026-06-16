// /api/flows — exchange inflow/outflow per tracked token.
// Returns mock data if ETHERSCAN_API_KEY is not set (clearly flagged).

import { NextResponse } from "next/server";
import { fetchExchangeFlows } from "@/lib/onchain/exchange-flows";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min

export async function GET() {
  try {
    const data = await fetchExchangeFlows();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Flows API error:", err);
    return NextResponse.json(
      { flows: [], isMock: true, fetchedAt: new Date().toISOString(), error: "failed" },
      { status: 500 },
    );
  }
}
