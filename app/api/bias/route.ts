// ═══════════════════════════════════════════════════════════════
// /api/bias?coin=BTC
// Slow-moving context for the Bias engine (polled every ~15s):
//   • asset ctx: mark/oracle price, OI, funding, 24h volume
//   • last 120 × 1m candles: volatility baseline for absorption
// The fast data (trades, book) streams straight from the HL WebSocket
// in the browser — it never touches this route.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HL_API = "https://api.hyperliquid.xyz/info";

async function hl<T>(body: object): Promise<T> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);
  return res.json() as Promise<T>;
}

interface Meta { universe: { name: string; szDecimals: number; maxLeverage: number }[] }
interface Ctx { funding: string; openInterest: string; prevDayPx: string; dayNtlVlm: string; premium: string | null; oraclePx: string; markPx: string }
interface RawCandle { t: number; o: string; h: string; l: string; c: string; v: string }

export async function GET(req: Request) {
  const coin = new URL(req.url).searchParams.get("coin");
  if (!coin || !/^[A-Za-z0-9]{1,20}$/.test(coin)) {
    return NextResponse.json({ error: "Invalid coin" }, { status: 400 });
  }

  try {
    const now = Date.now();
    const [[meta, ctxs], candles] = await Promise.all([
      hl<[Meta, Ctx[]]>({ type: "metaAndAssetCtxs" }),
      hl<RawCandle[]>({
        type: "candleSnapshot",
        req: { coin, interval: "1m", startTime: now - 120 * 60_000, endTime: now },
      }),
    ]);

    const idx = meta.universe.findIndex((a) => a.name === coin);
    if (idx < 0 || !ctxs[idx]) {
      return NextResponse.json({ error: `Unknown coin ${coin}` }, { status: 404 });
    }
    const c = ctxs[idx];
    const markPx = parseFloat(c.markPx);
    const prevDayPx = parseFloat(c.prevDayPx);

    return NextResponse.json({
      coin,
      t: now,
      ctx: {
        markPx,
        oraclePx: parseFloat(c.oraclePx),
        oi: parseFloat(c.openInterest),
        oiUsd: parseFloat(c.openInterest) * markPx,
        fundingHourly: parseFloat(c.funding),
        premium: c.premium ? parseFloat(c.premium) : 0,
        volume24hUsd: parseFloat(c.dayNtlVlm),
        change24hPct: prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0,
        maxLeverage: meta.universe[idx].maxLeverage,
      },
      candles: (Array.isArray(candles) ? candles : []).map((k) => ({
        t: k.t,
        o: parseFloat(k.o),
        h: parseFloat(k.h),
        l: parseFloat(k.l),
        c: parseFloat(k.c),
        v: parseFloat(k.v),
      })),
    });
  } catch (err) {
    console.error("Bias API error:", err);
    return NextResponse.json({ error: "Failed to reach Hyperliquid" }, { status: 502 });
  }
}
