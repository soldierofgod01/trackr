// ═══════════════════════════════════════════════════════════════
// Setup classification + trade plan generation.
//
// We map each scored token into one of three trader styles:
//   - squeeze:  positioning compressed against the direction of price
//   - trend:    OI + momentum + price all aligned in one direction
//   - reversal: positioning extreme + price exhausted at edge of range
//
// For each setup we generate a basic trade plan (direction, entry zone,
// invalidation, target). These are ALGORITHMIC HEURISTICS, not validated
// signals — they're starting points for a trader's own analysis.
// ═══════════════════════════════════════════════════════════════

import type { PressureScore } from "./scoring";

export type SetupType = "squeeze" | "trend" | "reversal";

export type Direction = "LONG" | "SHORT" | "WATCH";

export interface TradePlan {
  direction: Direction;
  // All prices are in USD, formatted by the UI layer
  entryZoneLow: number;
  entryZoneHigh: number;
  invalidation: number;   // price where the thesis breaks
  target: number;         // first reasonable take-profit
  // Calibration: how much we trust this plan. "high" / "medium" / "low"
  confidence: "high" | "medium" | "low";
}

export interface SetupCandidate {
  score: PressureScore;
  setupType: SetupType;
  // A "fit score" for THIS setup style — different from raw pressure score.
  // Tells us how well this token matches the setup pattern (0-100).
  fitScore: number;
  thesis: string;        // plain-English explanation of WHY this is the setup
  plan: TradePlan;
}

// ─── Classification: does this token fit a particular setup style? ───

/**
 * Classify a scored token by which setup style it best matches.
 * Returns null if the token doesn't cleanly fit any of our three styles.
 * The fitScore is the strength of that fit (0-100).
 */
export function classifySetup(s: PressureScore): SetupCandidate | null {
  const { raw, priceChange24hPct } = s;
  const oiChange = raw.openInterestChange24hPct;
  const funding = raw.fundingRate8h;

  // ── SQUEEZE: price moving one way, positioning trapped the other way ──
  // The classic case: price rising, shorts paying funding (negative funding).
  // Or inverse: price falling, longs paying funding (positive funding).
  if (
    (priceChange24hPct > 2 && funding < -0.005 && oiChange > 0) ||
    (priceChange24hPct < -2 && funding > 0.02 && oiChange > 0)
  ) {
    const isShortSqueeze = priceChange24hPct > 0;
    const direction: Direction = isShortSqueeze ? "LONG" : "SHORT";
    // Fit is highest when funding is most extreme AGAINST price direction
    const fundingPressure = Math.min(100, Math.abs(funding) / 0.001);
    const momentumStrength = Math.min(100, Math.abs(priceChange24hPct) * 8);
    const fitScore = Math.round((fundingPressure * 0.5) + (momentumStrength * 0.5));

    const thesis = isShortSqueeze
      ? `Price up ${priceChange24hPct.toFixed(1)}% but shorts are paying ${(Math.abs(funding) * 100).toFixed(2)} bps funding to stay short. OI is rising — they're adding, not closing. Pain trade is higher.`
      : `Price down ${Math.abs(priceChange24hPct).toFixed(1)}% with longs paying ${(funding * 100).toFixed(2)} bps. OI rising — longs doubling down into weakness. Liquidation cascade risk.`;

    return {
      score: s,
      setupType: "squeeze",
      fitScore,
      thesis,
      plan: makeSqueezePlan(raw.markPrice, direction, Math.abs(priceChange24hPct)),
    };
  }

  // ── TREND: OI + momentum + funding all aligned with price direction ──
  // Building positions with price + reasonable (not extreme) funding.
  if (
    oiChange > 3 &&
    Math.abs(priceChange24hPct) > 1.5 &&
    Math.abs(funding) < 0.04 &&
    // Funding direction matches price direction (longs paying on a rip is OK
    // here, just not extreme)
    Math.sign(funding) === Math.sign(priceChange24hPct)
  ) {
    const direction: Direction = priceChange24hPct > 0 ? "LONG" : "SHORT";
    const oiStrength = Math.min(100, oiChange * 6);
    const momentumStrength = Math.min(100, Math.abs(priceChange24hPct) * 6);
    const fitScore = Math.round((oiStrength * 0.6) + (momentumStrength * 0.4));

    const thesis = `OI up ${oiChange.toFixed(1)}%, price ${direction === "LONG" ? "up" : "down"} ${Math.abs(priceChange24hPct).toFixed(1)}%, funding at ${(funding * 100).toFixed(2)} bps (not extreme). Capital is positioning ${direction === "LONG" ? "long" : "short"} with conviction — clean trend continuation candidate.`;

    return {
      score: s,
      setupType: "trend",
      fitScore,
      thesis,
      plan: makeTrendPlan(raw.markPrice, direction, Math.abs(priceChange24hPct)),
    };
  }

  // ── REVERSAL: extreme funding + OI peaked + momentum stalling ──
  // Classic top/bottom: everyone leaning one way, price not extending.
  if (
    Math.abs(funding) > 0.05 &&
    oiChange > 4 &&
    Math.abs(priceChange24hPct) < 4   // momentum has stalled
  ) {
    // Reversal goes AGAINST the crowded side
    const direction: Direction = funding > 0 ? "SHORT" : "LONG";
    const fundingPressure = Math.min(100, Math.abs(funding) / 0.001);
    const oiStrength = Math.min(100, oiChange * 5);
    const stallPenalty = 1 - Math.min(1, Math.abs(priceChange24hPct) / 4);
    const fitScore = Math.round(((fundingPressure * 0.4) + (oiStrength * 0.4) + (stallPenalty * 20)));

    const crowdedSide = funding > 0 ? "longs" : "shorts";
    const thesis = `OI up ${oiChange.toFixed(1)}% and funding at ${(funding * 100).toFixed(2)} bps — ${crowdedSide} are crowded and paying to stay positioned. Price has stalled (${priceChange24hPct.toFixed(1)}% over 24h). When positioning gets this one-sided without follow-through, mean reversion risk rises.`;

    return {
      score: s,
      setupType: "reversal",
      fitScore,
      thesis,
      plan: makeReversalPlan(raw.markPrice, direction),
    };
  }

  return null;
}

// ─── Trade plan generators ───
// These produce a SIMPLE entry/invalidation/target frame based on price + a
// rough volatility proxy. Real S/R levels would need candle data — for v11
// we use ATR-style percentage moves from the mark price.

function makeSqueezePlan(price: number, direction: Direction, momentumPct: number): TradePlan {
  // Squeeze plans are TIGHTER because we're trying to catch the impulse.
  // Entry: pullback to recent area; invalidation: tight stop; target: bigger.
  const volatility = Math.max(0.012, Math.min(0.04, momentumPct / 100 * 1.5));

  if (direction === "LONG") {
    return {
      direction: "LONG",
      entryZoneLow: round(price * (1 - volatility * 0.6)),
      entryZoneHigh: round(price * (1 - volatility * 0.1)),
      invalidation: round(price * (1 - volatility * 1.4)),
      target: round(price * (1 + volatility * 3)),
      confidence: "medium",
    };
  }
  return {
    direction: "SHORT",
    entryZoneLow: round(price * (1 + volatility * 0.1)),
    entryZoneHigh: round(price * (1 + volatility * 0.6)),
    invalidation: round(price * (1 + volatility * 1.4)),
    target: round(price * (1 - volatility * 3)),
    confidence: "medium",
  };
}

function makeTrendPlan(price: number, direction: Direction, momentumPct: number): TradePlan {
  // Trend plans allow a wider entry zone (you wait for a pullback) and a
  // looser invalidation (don't get stopped out by noise on a trend).
  const volatility = Math.max(0.015, Math.min(0.05, momentumPct / 100 * 1.3));

  if (direction === "LONG") {
    return {
      direction: "LONG",
      entryZoneLow: round(price * (1 - volatility * 1.0)),
      entryZoneHigh: round(price * (1 - volatility * 0.2)),
      invalidation: round(price * (1 - volatility * 2.2)),
      target: round(price * (1 + volatility * 3.5)),
      confidence: "high",
    };
  }
  return {
    direction: "SHORT",
    entryZoneLow: round(price * (1 + volatility * 0.2)),
    entryZoneHigh: round(price * (1 + volatility * 1.0)),
    invalidation: round(price * (1 + volatility * 2.2)),
    target: round(price * (1 - volatility * 3.5)),
    confidence: "high",
  };
}

function makeReversalPlan(price: number, direction: Direction): TradePlan {
  // Reversal plans use TIGHT invalidation (catching a falling knife — if you're
  // wrong you should know fast) and modest targets (mean reversion typically
  // gives back recent excess, not a full trend).
  const volatility = 0.025;

  if (direction === "LONG") {
    return {
      direction: "LONG",
      entryZoneLow: round(price * (1 - volatility * 0.5)),
      entryZoneHigh: round(price),
      invalidation: round(price * (1 - volatility * 1.6)),
      target: round(price * (1 + volatility * 2.5)),
      confidence: "low",
    };
  }
  return {
    direction: "SHORT",
    entryZoneLow: round(price),
    entryZoneHigh: round(price * (1 + volatility * 0.5)),
    invalidation: round(price * (1 + volatility * 1.6)),
    target: round(price * (1 - volatility * 2.5)),
    confidence: "low",
  };
}

function round(n: number): number {
  // Smart rounding by magnitude — keep meaningful precision for small prices
  if (n >= 1000) return Math.round(n);
  if (n >= 10) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 1000) / 1000;
  if (n >= 0.01) return Math.round(n * 10000) / 10000;
  return Math.round(n * 1000000) / 1000000;
}

// ─── Market regime detection ───
// Aggregate sentiment of all HL perps. We classify into 3 buckets.

export type MarketRegime = "risk_on" | "risk_off" | "chop";

export interface RegimeRead {
  regime: MarketRegime;
  label: string;
  detail: string;
  // Aggregate stats so the UI can show transparency
  avgScore: number;
  pctPositiveOI: number;       // % of tokens where OI is building
  avgFundingBps: number;       // average funding rate in basis points
  avgPriceChange24h: number;
}

export function detectRegime(scores: PressureScore[]): RegimeRead {
  if (scores.length === 0) {
    return {
      regime: "chop",
      label: "No data",
      detail: "Not enough data to read the market",
      avgScore: 0,
      pctPositiveOI: 0,
      avgFundingBps: 0,
      avgPriceChange24h: 0,
    };
  }

  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  const positiveOI = scores.filter((s) => s.raw.openInterestChange24hPct > 2).length;
  const pctPositiveOI = (positiveOI / scores.length) * 100;
  const avgFunding = scores.reduce((sum, s) => sum + s.raw.fundingRate8h, 0) / scores.length;
  const avgFundingBps = avgFunding * 100;  // funding is already in % so * 100 = bps
  const avgPriceChange = scores.reduce((sum, s) => sum + s.priceChange24hPct, 0) / scores.length;

  // Risk-on: broad OI building + positive momentum + funding not crowded
  if (pctPositiveOI > 55 && avgPriceChange > 0.5 && avgFundingBps < 5) {
    return {
      regime: "risk_on",
      label: "Risk-on",
      detail: `${pctPositiveOI.toFixed(0)}% of perps building OI, avg +${avgPriceChange.toFixed(1)}% — capital deploying broadly`,
      avgScore: Math.round(avgScore),
      pctPositiveOI: Math.round(pctPositiveOI),
      avgFundingBps: Math.round(avgFundingBps * 10) / 10,
      avgPriceChange24h: Math.round(avgPriceChange * 10) / 10,
    };
  }

  // Risk-off: broad OI declining + negative momentum
  if (pctPositiveOI < 35 && avgPriceChange < -0.5) {
    return {
      regime: "risk_off",
      label: "Risk-off",
      detail: `Only ${pctPositiveOI.toFixed(0)}% of perps building OI, avg ${avgPriceChange.toFixed(1)}% — positions closing across the board`,
      avgScore: Math.round(avgScore),
      pctPositiveOI: Math.round(pctPositiveOI),
      avgFundingBps: Math.round(avgFundingBps * 10) / 10,
      avgPriceChange24h: Math.round(avgPriceChange * 10) / 10,
    };
  }

  // Default: chop (mixed signals)
  return {
    regime: "chop",
    label: "Chop",
    detail: `Mixed signals: ${pctPositiveOI.toFixed(0)}% building OI, avg ${avgPriceChange >= 0 ? "+" : ""}${avgPriceChange.toFixed(1)}% — no clear directional bias`,
    avgScore: Math.round(avgScore),
    pctPositiveOI: Math.round(pctPositiveOI),
    avgFundingBps: Math.round(avgFundingBps * 10) / 10,
    avgPriceChange24h: Math.round(avgPriceChange * 10) / 10,
  };
}

// ─── Helpers for the UI ───

export const SETUP_META: Record<SetupType, { label: string; emoji: string; description: string; color: string }> = {
  squeeze: {
    label: "Squeeze",
    emoji: "🪤",
    description: "Positioning trapped against price direction. Catch the cascade.",
    color: "#22D3EE",
  },
  trend: {
    label: "Trend",
    emoji: "📈",
    description: "OI + momentum + price aligned. Ride the move.",
    color: "#10B981",
  },
  reversal: {
    label: "Reversal",
    emoji: "🔄",
    description: "Crowd one-sided, momentum stalled. Fade the extreme.",
    color: "#F97316",
  },
};

export const REGIME_COLORS: Record<MarketRegime, string> = {
  risk_on: "#10B981",
  risk_off: "#EF4444",
  chop: "#A1A1AA",
};

// ─── Pressure trend (building / peaking / fading) ───
// Without historical OI snapshots we infer trend phase from the current shape
// of the data. This is a proxy — once we snapshot OI hourly into Supabase
// we can replace this with a real delta over time.

export type PressureTrend = "building" | "peaking" | "fading";

export function inferPressureTrend(
  fitScore: number,
  raw: PressureScore["raw"],
  priceChange24hPct: number,
): PressureTrend {
  const oiChange = raw.openInterestChange24hPct;
  const fundingAbs = Math.abs(raw.fundingRate8h);
  const momentumAbs = Math.abs(priceChange24hPct);

  // Peaking: very high fit + extreme funding + stalled or slowing momentum.
  // Translation: positioning is maxed out and the move can't extend further.
  if (fitScore > 50 && fundingAbs > 0.06 && momentumAbs < 3) {
    return "peaking";
  }
  // Fading: OI dropping = positions closing. The setup is dissolving.
  if (oiChange < 0 || (oiChange < 2 && fundingAbs < 0.01)) {
    return "fading";
  }
  // Default: building — OI growing, fit score meaningful, room to extend.
  return "building";
}

export const TREND_META: Record<PressureTrend, { label: string; icon: "up" | "side" | "down"; color: string; note: string }> = {
  building: {
    label: "Building",
    icon: "up",
    color: "#10B981",
    note: "Positioning still entering — early-mid phase",
  },
  peaking: {
    label: "Peaking",
    icon: "side",
    color: "#F97316",
    note: "Setup matured — entering a reactive window",
  },
  fading: {
    label: "Fading",
    icon: "down",
    color: "#71717A",
    note: "Positioning unwinding — setup dissolving",
  },
};

// ─── "Why this matters NOW" line ───
// Generates a short timing-relevant statement separate from the structural
// thesis. The thesis explains the setup; this explains the moment.

export function whyNow(
  setupType: SetupType,
  trend: PressureTrend,
  raw: PressureScore["raw"],
  priceChange24hPct: number,
): string {
  const funding8h = raw.fundingRate8h;
  const oiUsd = raw.openInterestUsd;
  const oiBn = oiUsd / 1e9;
  const oiMm = oiUsd / 1e6;
  const oiStr = oiBn >= 1 ? `$${oiBn.toFixed(2)}B` : `$${oiMm.toFixed(0)}M`;

  if (trend === "peaking") {
    if (setupType === "squeeze") {
      return `Funding at ${(funding8h * 100).toFixed(1)} bps with ${oiStr} of OI sitting against the move. Liquidation cluster within reach.`;
    }
    if (setupType === "reversal") {
      return `${oiStr} stacked one direction and momentum has stalled. The next ${Math.abs(funding8h * 100).toFixed(0)} bps of funding pays for nothing — exit window narrowing.`;
    }
    return `Trend has run hot — OI maxed, funding extreme. Pullback risk elevated.`;
  }

  if (trend === "fading") {
    return `OI declining — original setup is dissolving. Wait for a fresher signal.`;
  }

  // Building
  if (setupType === "squeeze") {
    return `Shorts paid ${Math.abs(funding8h * 100).toFixed(1)} bps last 8h while OI grew. Each hour they stay, the cost compounds.`;
  }
  if (setupType === "trend") {
    return `Capital is still flowing in — ${oiStr} of OI and ${priceChange24hPct > 0 ? "rising" : "falling"} steady. Trend has room.`;
  }
  // reversal building
  return `Position crowding accelerating. The fade window opens when momentum confirms stall.`;
}

// ─── Sub-score breakdown for UI bars ───
// Returns the four component weights normalized to percentages of their max
// contribution to fit. UI uses these to render visual bars showing what's
// driving the signal.

export interface SubScoreBars {
  oi: { pct: number; raw: string };          // OI change %
  funding: { pct: number; raw: string };     // funding bps
  momentum: { pct: number; raw: string };    // 24h price %
  oiVol: { pct: number; raw: string };       // OI/Vol ratio
}

export function buildSubScores(raw: PressureScore["raw"], priceChange24hPct: number): SubScoreBars {
  // OI: ±20% maps to 0-100
  const oiPct = Math.max(0, Math.min(100, 50 + (raw.openInterestChange24hPct / 20) * 50));
  // Funding: ±15bps (0.15%) is extreme = 100, neutral = 50
  const fundingPct = Math.max(0, Math.min(100, 50 + (Math.abs(raw.fundingRate8h) / 0.15) * 50));
  // Momentum: ±10% maps to 0-100
  const momentumPct = Math.max(0, Math.min(100, 50 + (priceChange24hPct / 10) * 50));
  // OI/Vol: 0 = healthy spot-led, 3+ = derivative-dominated. Convert to a
  // "concentration" reading where higher = more concerning concentration.
  const oiVolRatio = raw.dayVolumeUsd > 0 ? raw.openInterestUsd / raw.dayVolumeUsd : 5;
  const oiVolPct = Math.max(0, Math.min(100, (oiVolRatio / 3.5) * 100));

  return {
    oi: { pct: Math.round(oiPct), raw: `${raw.openInterestChange24hPct >= 0 ? "+" : ""}${raw.openInterestChange24hPct.toFixed(1)}%` },
    funding: { pct: Math.round(fundingPct), raw: `${(raw.fundingRate8h * 100).toFixed(1)}bps` },
    momentum: { pct: Math.round(momentumPct), raw: `${priceChange24hPct >= 0 ? "+" : ""}${priceChange24hPct.toFixed(1)}%` },
    oiVol: { pct: Math.round(oiVolPct), raw: oiVolRatio.toFixed(2) + "x" },
  };
}
