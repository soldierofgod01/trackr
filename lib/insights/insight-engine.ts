// ═══════════════════════════════════════════════════════════════
// Mako Insight Engine
//
// This is the heart of Mako's thesis: every other tool shows the data,
// Mako tells you what it MEANS. Each rule encodes a real, well-known
// perp-trading read — not invented formula weights, but relationships
// experienced traders actually act on.
//
// IMPORTANT HONESTY CONSTRAINT: these rules work on a single snapshot of
// current data (funding, OI, price-24h, OI/vol ratio). Reads that require
// trend-over-time ("OI rising for 4h") need historical snapshots we don't
// store yet (Supabase). Those come later. v1 = what's defensible from a
// snapshot.
//
// Each insight is interpretation, NOT a trade call. The trader decides.
// ═══════════════════════════════════════════════════════════════

import type { HLPerpMarket } from "@/lib/api/hl-perps";

export interface DataPoint {
  label: string;
  value: string;
  tone: "pos" | "neg" | "neutral";
}

export interface Insight {
  symbol: string;
  setup: string;              // setup name, e.g. "Potential short squeeze"
  meaning: string;            // plain-English "what this usually means"
  dataPoints: DataPoint[];    // the 3-4 evidence points
  strength: number;           // 0-100, how strongly this market fits the rule
  direction: "bullish" | "bearish" | "neutral";
}

function fmtPct(n: number, dp = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}
function fmtUsd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── The rules ───
// Each takes a market and returns an Insight if the market fits, else null.

// RULE 1 — Short squeeze risk:
// Price UP on the day + NEGATIVE funding = shorts are paying to stay short
// while price rises against them. Classic setup where trapped shorts can
// get force-liquidated, fueling further upside.
function ruleShortSqueeze(m: HLPerpMarket): Insight | null {
  if (m.priceChange24hPct > 2 && m.fundingRate8h < -0.005) {
    const strength = Math.min(100, Math.abs(m.fundingRate8h) * 1500 + m.priceChange24hPct * 3);
    return {
      symbol: m.symbol,
      setup: "Potential short squeeze",
      meaning:
        "Price is rising while funding is negative — shorts are paying to hold losing positions. If they're forced to cover, it can accelerate the move up.",
      direction: "bullish",
      strength,
      dataPoints: [
        { label: "24h price", value: fmtPct(m.priceChange24hPct), tone: "pos" },
        { label: "Funding 8h", value: fmtPct(m.fundingRate8h, 4), tone: "neg" },
        { label: "Open interest", value: fmtUsd(m.openInterestUsd), tone: "neutral" },
      ],
    };
  }
  return null;
}

// RULE 2 — Long squeeze / crowded long risk:
// Price DOWN + POSITIVE (high) funding = longs paying heavily while price
// falls against them. Crowded longs at risk of liquidation cascade down.
function ruleLongSqueeze(m: HLPerpMarket): Insight | null {
  if (m.priceChange24hPct < -2 && m.fundingRate8h > 0.005) {
    const strength = Math.min(100, m.fundingRate8h * 1500 + Math.abs(m.priceChange24hPct) * 3);
    return {
      symbol: m.symbol,
      setup: "Crowded longs at risk",
      meaning:
        "Price is falling while funding stays positive — longs are paying to hold losing positions. If they capitulate, liquidations can accelerate the move down.",
      direction: "bearish",
      strength,
      dataPoints: [
        { label: "24h price", value: fmtPct(m.priceChange24hPct), tone: "neg" },
        { label: "Funding 8h", value: fmtPct(m.fundingRate8h, 4), tone: "pos" },
        { label: "Open interest", value: fmtUsd(m.openInterestUsd), tone: "neutral" },
      ],
    };
  }
  return null;
}

// RULE 3 — Extreme funding / reversal risk:
// Very high absolute funding = one side is extremely crowded and paying
// dearly. Extremes often mean-revert. Direction of the read is AGAINST the
// crowded side.
function ruleExtremeFunding(m: HLPerpMarket): Insight | null {
  const annual = Math.abs(m.fundingRateAnnualPct);
  if (annual > 50) {
    const longsCrowded = m.fundingRate8h > 0;
    const strength = Math.min(100, annual / 2);
    return {
      symbol: m.symbol,
      setup: longsCrowded ? "Longs extremely crowded" : "Shorts extremely crowded",
      meaning: longsCrowded
        ? "Funding is extremely positive — longs are paying a heavy premium. Crowded positioning like this often unwinds, raising reversal risk to the downside."
        : "Funding is extremely negative — shorts are paying a heavy premium. Crowded short positioning often unwinds, raising reversal risk to the upside.",
      direction: longsCrowded ? "bearish" : "bullish",
      strength,
      dataPoints: [
        { label: "Funding (APR)", value: fmtPct(m.fundingRateAnnualPct, 0), tone: longsCrowded ? "pos" : "neg" },
        { label: "Funding 8h", value: fmtPct(m.fundingRate8h, 4), tone: longsCrowded ? "pos" : "neg" },
        { label: "24h price", value: fmtPct(m.priceChange24hPct), tone: m.priceChange24hPct >= 0 ? "pos" : "neg" },
      ],
    };
  }
  return null;
}

// RULE 4 — Derivative-led move (low conviction):
// OI/Volume ratio very high = the move is driven by leverage/positioning,
// not spot buying. These moves are more fragile and prone to sharp reversals.
function ruleDerivativeLed(m: HLPerpMarket): Insight | null {
  if (m.oiToVolumeRatio > 2 && Math.abs(m.priceChange24hPct) > 3) {
    const strength = Math.min(100, m.oiToVolumeRatio * 20);
    const up = m.priceChange24hPct > 0;
    return {
      symbol: m.symbol,
      setup: "Leverage-driven move",
      meaning:
        "Open interest is large relative to actual volume — this move is driven more by leveraged positioning than real spot demand. Leverage-led moves tend to be more fragile and can reverse sharply.",
      direction: "neutral",
      strength,
      dataPoints: [
        { label: "OI / Volume", value: `${m.oiToVolumeRatio.toFixed(2)}x`, tone: "neutral" },
        { label: "24h price", value: fmtPct(m.priceChange24hPct), tone: up ? "pos" : "neg" },
        { label: "Volume 24h", value: fmtUsd(m.volume24hUsd), tone: "neutral" },
      ],
    };
  }
  return null;
}

const RULES = [ruleShortSqueeze, ruleLongSqueeze, ruleExtremeFunding, ruleDerivativeLed];

// Generate insights across all markets, return the strongest, deduped so one
// market doesn't dominate with multiple weak reads (keep its strongest).
export function generateInsights(markets: HLPerpMarket[], limit = 8): Insight[] {
  // Only consider markets with meaningful liquidity
  const liquid = markets.filter((m) => m.openInterestUsd >= 1_000_000 && m.volume24hUsd >= 1_000_000);

  const all: Insight[] = [];
  for (const m of liquid) {
    for (const rule of RULES) {
      const insight = rule(m);
      if (insight) all.push(insight);
    }
  }

  // Keep only the strongest insight per symbol
  const bySymbol = new Map<string, Insight>();
  for (const ins of all) {
    const existing = bySymbol.get(ins.symbol);
    if (!existing || ins.strength > existing.strength) {
      bySymbol.set(ins.symbol, ins);
    }
  }

  return Array.from(bySymbol.values())
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}
