// ═══════════════════════════════════════════════════════════════
// Hyperliquid public API — perp open interest + funding rates
// Endpoint: POST https://api.hyperliquid.xyz/info
// Body: { type: "metaAndAssetCtxs" }
// Returns [meta, ctxs] where ctxs[i] corresponds to meta.universe[i]
// ═══════════════════════════════════════════════════════════════

interface HLAssetMeta {
  name: string;       // e.g. "BTC", "ETH", "SOL"
  szDecimals: number;
  maxLeverage: number;
}

interface HLAssetCtx {
  funding: string;        // current funding rate (per hour, e.g. "0.0000125")
  openInterest: string;   // in coin units, e.g. "12345.6"
  prevDayPx: string;      // previous day price
  dayNtlVlm: string;      // 24h notional volume (USD)
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: [string, string];
}

export interface HLPerpData {
  symbol: string;            // matches CoinGecko symbol uppercase
  openInterestUsd: number;
  openInterestChange24h: number;  // % vs prev day (we approximate from price delta)
  fundingRate8h: number;     // funding × 8 (HL funding is per-hour)
  markPrice: number;
  dayVolumeUsd: number;
}

const HL_API = "https://api.hyperliquid.xyz/info";

export async function fetchHyperliquidPerps(): Promise<Record<string, HLPerpData>> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid ${res.status}: ${res.statusText}`);
  }

  const [meta, ctxs] = (await res.json()) as [{ universe: HLAssetMeta[] }, HLAssetCtx[]];

  const map: Record<string, HLPerpData> = {};

  meta.universe.forEach((asset, i) => {
    const ctx = ctxs[i];
    if (!ctx) return;

    const markPx = parseFloat(ctx.markPx);
    const prevDayPx = parseFloat(ctx.prevDayPx);
    const oiCoin = parseFloat(ctx.openInterest);
    const oiUsd = oiCoin * markPx;
    const fundingHourly = parseFloat(ctx.funding);
    const dayVol = parseFloat(ctx.dayNtlVlm);

    // OI 24h change — Hyperliquid doesn't give us historical OI directly via this endpoint.
    // We approximate using % price change as a proxy (rough but visually meaningful).
    // For a real production app we'd snapshot OI daily — out of scope for v1.
    const priceChangePct = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

    // Funding rate is typically displayed as the 8h cumulative rate on most exchanges.
    // Hyperliquid charges funding hourly, so 8h ≈ hourly × 8.
    const funding8h = fundingHourly * 8 * 100;  // express as percent

    map[asset.name.toUpperCase()] = {
      symbol: asset.name.toUpperCase(),
      openInterestUsd: oiUsd,
      openInterestChange24h: priceChangePct,  // proxy
      fundingRate8h: funding8h,
      markPrice: markPx,
      dayVolumeUsd: dayVol,
    };
  });

  return map;
}
