// ═══════════════════════════════════════════════════════════════
// Hyperliquid perp markets — the Scanner's single data source (v19).
//
// One endpoint, one source of truth: POST /info { type: "metaAndAssetCtxs" }
// Returns every HL perp with price, OI, funding, 24h volume, 24h change.
// No CoinGecko, no Binance — every row is a real HL market with full data.
// ═══════════════════════════════════════════════════════════════

interface HLAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface HLAssetCtx {
  funding: string;        // hourly funding rate
  openInterest: string;   // in coin units
  prevDayPx: string;      // price 24h ago
  dayNtlVlm: string;      // 24h notional volume (USD)
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
}

export interface HLPerpMarket {
  symbol: string;              // e.g. "BTC", "ETH" — HL's native name
  markPrice: number;
  prevDayPrice: number;
  priceChange24hPct: number;   // real, from prevDayPx — accurate
  openInterestUsd: number;
  fundingRate8h: number;       // % — hourly funding × 8
  fundingRateAnnualPct: number;// annualized funding (APR) — % 
  volume24hUsd: number;
  maxLeverage: number;
  oiToVolumeRatio: number;     // OI / 24h volume — derivative concentration
}

const HL_API = "https://api.hyperliquid.xyz/info";

export async function fetchHLPerpMarkets(): Promise<HLPerpMarket[]> {
  const res = await fetch(HL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    next: { revalidate: 15 },
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid ${res.status}: ${res.statusText}`);
  }

  const [meta, ctxs] = (await res.json()) as [
    { universe: HLAssetMeta[] },
    HLAssetCtx[],
  ];

  const markets: HLPerpMarket[] = [];

  meta.universe.forEach((asset, i) => {
    const ctx = ctxs[i];
    if (!ctx) return;

    const markPx = parseFloat(ctx.markPx);
    const prevDayPx = parseFloat(ctx.prevDayPx);
    const oiCoin = parseFloat(ctx.openInterest);
    const oiUsd = oiCoin * markPx;
    const fundingHourly = parseFloat(ctx.funding);
    const dayVol = parseFloat(ctx.dayNtlVlm);

    // Skip markets with no meaningful activity (delisted / dead)
    if (!isFinite(markPx) || markPx <= 0) return;
    if (oiUsd < 10_000 && dayVol < 10_000) return;

    const priceChange24hPct =
      prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

    // HL charges funding hourly. 8h rate = hourly × 8. Annualized = hourly × 24 × 365.
    const funding8h = fundingHourly * 8 * 100;
    const fundingAnnual = fundingHourly * 24 * 365 * 100;

    const oiToVol = dayVol > 0 ? oiUsd / dayVol : 0;

    markets.push({
      symbol: asset.name.toUpperCase(),
      markPrice: markPx,
      prevDayPrice: prevDayPx,
      priceChange24hPct,
      openInterestUsd: oiUsd,
      fundingRate8h: funding8h,
      fundingRateAnnualPct: fundingAnnual,
      volume24hUsd: dayVol,
      maxLeverage: asset.maxLeverage,
      oiToVolumeRatio: oiToVol,
    });
  });

  return markets;
}
