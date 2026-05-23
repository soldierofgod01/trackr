// ═══════════════════════════════════════════════════════════════
// Flow Pressure Map — scoring engine
//
// Each token gets a 0-100 score combining four signals:
//   - OI change 24h (40 points)    : building or distributing?
//   - Funding extremity (20 points) : crowded vs contrarian positioning?
//   - Price momentum 24h (20 points): which way is it moving?
//   - OI/Volume ratio (20 points)   : derivative-led vs spot-led move?
//
// Score interpretation:
//   85-100: Strong building pressure (bullish)
//   65-84:  Building
//   45-64:  Mixed / Neutral
//   25-44:  Distributing / weak
//   0-24:   Distribution / exit
//
// Special states detected separately from raw score:
//   "Overheated longs"  - high positive funding + high OI
//   "Crowded shorts"    - very negative funding + high OI
//   "Squeeze setup"     - rising price + negative funding (shorts paying)
//   "Distribution risk" - OI rising while price falling
// ═══════════════════════════════════════════════════════════════

export interface PerpRawData {
  symbol: string;
  markPrice: number;
  prevDayPrice: number;
  openInterestUsd: number;
  openInterestChange24hPct: number;  // % change in OI vs 24h ago (approximated)
  fundingRate8h: number;             // expressed as percent (e.g. 0.012 means 0.012%)
  dayVolumeUsd: number;
}

export interface PressureScore {
  symbol: string;
  score: number;          // 0-100
  state: PressureState;
  why: string;            // one-line trader-language explanation
  breakdown: {
    oi: number;           // 0-40
    funding: number;      // 0-20
    momentum: number;     // 0-20
    oiVolume: number;     // 0-20
  };
  raw: PerpRawData;
  priceChange24hPct: number;
}

export type PressureState =
  | "building"
  | "distributing"
  | "overheated_longs"
  | "crowded_shorts"
  | "squeeze_setup"
  | "distribution_risk"
  | "neutral";

export function scoreToken(d: PerpRawData): PressureScore {
  const priceChangePct = d.prevDayPrice > 0
    ? ((d.markPrice - d.prevDayPrice) / d.prevDayPrice) * 100
    : 0;

  // ── OI signal (0-40) ──
  // +10% OI 24h = strong positive (40); -10% = strong negative (0)
  // Clamp at ±20% for the extremes.
  const oiNorm = Math.max(-1, Math.min(1, d.openInterestChange24hPct / 20));
  const oiScore = 20 + oiNorm * 20;   // 0 at -20%, 20 at 0%, 40 at +20%

  // ── Funding signal (0-20) ──
  // Funding interpretation differs from OI:
  //   - HIGH positive funding (longs paying) = overheated/risky → low score (bearish for price)
  //   - LOW/negative funding = contrarian-bullish → high score
  // Typical range: ±0.05% per 8h. Extreme: ±0.15% per 8h.
  const fundingNorm = Math.max(-1, Math.min(1, -d.fundingRate8h / 0.05));
  // -0.05% funding → +1 (bullish for price), +0.05% funding → -1 (bearish)
  const fundingScore = 10 + fundingNorm * 10;  // 0-20 range

  // ── Momentum signal (0-20) ──
  // ±10% 24h move = extreme. Clamp.
  const momNorm = Math.max(-1, Math.min(1, priceChangePct / 10));
  const momentumScore = 10 + momNorm * 10;

  // ── OI/Volume ratio (0-20) ──
  // High OI relative to volume = derivative-driven move = less sustainable
  // Low ratio = spot-led move = more sustainable
  // Typical healthy ratio is ~0.3-1.5 (OI / 24h vol)
  // We REWARD low ratios (high score) and penalize very high ratios (low score)
  const oiVolRatio = d.dayVolumeUsd > 0 ? d.openInterestUsd / d.dayVolumeUsd : 5;
  // Below 1.0 = healthy spot-led, 1.0-3.0 = moderate, above 3.0 = derivative-dominated
  const oiVolNorm = Math.max(0, Math.min(1, (3.5 - oiVolRatio) / 3.5));
  const oiVolScore = oiVolNorm * 20;

  const rawScore = oiScore + fundingScore + momentumScore + oiVolScore;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  // ── State detection (rules-based, overrides raw score for special situations) ──
  let state: PressureState = "neutral";
  let why = "";

  // Squeeze: rising price + negative funding (shorts paying longs)
  if (priceChangePct > 3 && d.fundingRate8h < -0.01) {
    state = "squeeze_setup";
    why = `Price up ${priceChangePct.toFixed(1)}% while shorts pay ${Math.abs(d.fundingRate8h).toFixed(3)}% funding — short squeeze setup`;
  }
  // Overheated longs: extreme positive funding + rising OI
  else if (d.fundingRate8h > 0.05 && d.openInterestChange24hPct > 5) {
    state = "overheated_longs";
    why = `OI up ${d.openInterestChange24hPct.toFixed(1)}%, longs paying ${d.fundingRate8h.toFixed(3)}% — crowded long`;
  }
  // Crowded shorts: extreme negative funding + rising OI
  else if (d.fundingRate8h < -0.05 && d.openInterestChange24hPct > 5) {
    state = "crowded_shorts";
    why = `OI up ${d.openInterestChange24hPct.toFixed(1)}% with funding at ${d.fundingRate8h.toFixed(3)}% — shorts paying a lot to stay positioned`;
  }
  // Distribution risk: OI rising while price falling
  else if (d.openInterestChange24hPct > 5 && priceChangePct < -3) {
    state = "distribution_risk";
    why = `Price down ${Math.abs(priceChangePct).toFixed(1)}% but OI up ${d.openInterestChange24hPct.toFixed(1)}% — new shorts piling in`;
  }
  // Distributing: OI dropping
  else if (d.openInterestChange24hPct < -5) {
    state = "distributing";
    why = `OI down ${Math.abs(d.openInterestChange24hPct).toFixed(1)}% — positions closing out`;
  }
  // Building: OI up + neutral/positive momentum
  else if (d.openInterestChange24hPct > 3 && priceChangePct > -1) {
    state = "building";
    why = `OI up ${d.openInterestChange24hPct.toFixed(1)}%, price ${priceChangePct >= 0 ? "up" : "flat"} ${priceChangePct.toFixed(1)}% — new positions building`;
  }
  else {
    state = "neutral";
    why = `No strong directional pressure detected`;
  }

  return {
    symbol: d.symbol,
    score,
    state,
    why,
    breakdown: {
      oi: Math.round(oiScore),
      funding: Math.round(fundingScore),
      momentum: Math.round(momentumScore),
      oiVolume: Math.round(oiVolScore),
    },
    raw: d,
    priceChange24hPct: priceChangePct,
  };
}

// Human-friendly state labels
export const STATE_LABELS: Record<PressureState, string> = {
  building: "Building",
  distributing: "Distributing",
  overheated_longs: "Overheated longs",
  crowded_shorts: "Crowded shorts",
  squeeze_setup: "Squeeze setup",
  distribution_risk: "Distribution risk",
  neutral: "Neutral",
};

// Color tokens for each state — used in cards and bars
export const STATE_COLORS: Record<PressureState, { fg: string; bg: string; border: string }> = {
  building:           { fg: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.30)" },
  squeeze_setup:      { fg: "#22D3EE", bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.30)" },
  overheated_longs:   { fg: "#F97316", bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.30)" },
  crowded_shorts:     { fg: "#A855F7", bg: "rgba(168,85,247,0.10)",  border: "rgba(168,85,247,0.30)" },
  distribution_risk:  { fg: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.30)" },
  distributing:       { fg: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.30)" },
  neutral:            { fg: "#71717A", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.30)" },
};
