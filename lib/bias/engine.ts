// ════════════════════════════════════════════════════════════════
// Mako Bias engine — order-flow → directional bias for ONE coin.
//
// Pure functions only (no React, no network) so every rule can be unit
// tested. Inputs come from Hyperliquid:
//   • trades    — WS `trades` (side "B" = buyer was the aggressor/taker)
//   • book      — WS `l2Book` snapshots (aggregated levels)
//   • ctx       — REST `metaAndAssetCtxs` polled every ~15s (OI, funding)
//   • candles   — REST `candleSnapshot` 1m (volatility baseline only)
//
// HONEST LIMITS (surface these in the UI, don't hide them):
//   • Hyperliquid has no public historical tape → CVD, aggression and
//     whale prints are measured from the moment the tab opens.
//   • No OI history endpoint → OI change is also session-based.
//   • The weights below are reasoned starting points, NOT back-tested.
//     The bias log (see log.ts) exists to measure them on live data.
// ════════════════════════════════════════════════════════════════

export interface Trade {
  t: number;      // ms
  px: number;
  sz: number;     // coin units
  usd: number;    // px * sz
  side: 1 | -1;   // +1 aggressive buy, -1 aggressive sell
}

export interface BookSample {
  t: number;
  imbalance: number; // (bidUsd - askUsd) / (bidUsd + askUsd) within band, [-1, 1]
  bidUsd: number;
  askUsd: number;
}

export interface CtxSample {
  t: number;
  markPx: number;
  oi: number;        // coin units
  fundingHourly: number;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type SignalId =
  | "delta"
  | "absorption"
  | "book"
  | "oi"
  | "whales"
  | "crowding";

export interface Signal {
  id: SignalId;
  label: string;
  weight: number;
  available: boolean;
  score: number;      // [-1, 1]  + = bullish, − = bearish
  value: string;      // the measured number, formatted
  read: string;       // plain-English meaning
  why?: string;       // shown when unavailable
}

export interface BiasResult {
  score: number;          // [-100, 100]
  direction: "long" | "short" | "neutral";
  strength: "strong" | "moderate" | "weak";
  confidence: number;     // [0, 100] — magnitude × data coverage × agreement
  coverage: number;       // [0, 1] share of total weight that had data
  agreeing: number;       // signals pointing the same way as the bias
  opposing: number;
  signals: Signal[];
  summary: string;
  tapeMinutes: number;
  warmingUp: boolean;
}

// ─── Tunables ───────────────────────────────────────────────────
export const WEIGHTS: Record<SignalId, number> = {
  delta: 0.25,       // who is aggressing — the core of order flow
  absorption: 0.2,   // effort vs result — aggression that fails to move price
  oi: 0.2,           // is new money opening, or positions closing?
  book: 0.1,         // resting liquidity — spoofable, so low weight
  whales: 0.15,      // direction of large aggressive prints
  crowding: 0.1,     // funding extremes — contrarian modifier
};

export const WARMUP_MINUTES = 3;
export const DELTA_WINDOW_MS = 15 * 60_000;
export const SHORT_WINDOW_MS = 5 * 60_000;
export const BOOK_WINDOW_MS = 5 * 60_000;
export const NEUTRAL_BAND = 20;   // |score| < 20 → neutral
export const STRONG_BAND = 45;

const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x));
const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

// ─── Helpers ────────────────────────────────────────────────────

/** Net aggressive USD and total USD for trades at/after `since`. */
export function deltaStats(trades: Trade[], since: number) {
  let buy = 0;
  let sell = 0;
  let n = 0;
  for (const tr of trades) {
    if (tr.t < since) continue;
    n++;
    if (tr.side === 1) buy += tr.usd;
    else sell += tr.usd;
  }
  const total = buy + sell;
  return { buy, sell, total, net: buy - sell, ratio: total > 0 ? (buy - sell) / total : 0, n };
}

/** Price at (or just after) a time, from the trade tape. */
export function priceAt(trades: Trade[], t: number): number | null {
  for (const tr of trades) if (tr.t >= t) return tr.px;
  return null;
}

/** Std-dev of 1-minute log returns from candles. */
export function oneMinuteVol(candles: Candle[]): number {
  if (candles.length < 10) return 0;
  const rets: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const a = candles[i - 1].c;
    const b = candles[i].c;
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 5) return 0;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const v = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(v);
}

/** Large-print threshold in USD, scaled to the market's 24h volume. */
export function whaleThreshold(volume24hUsd: number): number {
  // ~1/20,000th of daily volume, floor $25k, cap $2M.
  // BTC ($2B/day) → $100k; mid-cap ($50M/day) → $25k.
  return clamp(volume24hUsd / 20_000, 25_000, 2_000_000);
}

export function fmtUsd(x: number): string {
  const a = Math.abs(x);
  const s = x < 0 ? "−" : x > 0 ? "+" : "";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a.toFixed(0)}`;
}

const pct = (x: number, d = 2) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}%`;

// ─── Signals ────────────────────────────────────────────────────

export function deltaSignal(trades: Trade[], now: number): Signal {
  const base: Signal = { id: "delta", label: "Aggressive delta", weight: WEIGHTS.delta, available: false, score: 0, value: "—", read: "" };
  const d15 = deltaStats(trades, now - DELTA_WINDOW_MS);
  const d5 = deltaStats(trades, now - SHORT_WINDOW_MS);
  const span = trades.length ? (now - trades[0].t) / 60_000 : 0;
  if (d15.n < 30 || span < 2) {
    return { ...base, why: "Collecting trades — needs ~2 min of tape." };
  }
  // Blend: recent 5m matters more, 15m gives persistence.
  const ratio = 0.6 * d5.ratio + 0.4 * d15.ratio;
  // A 30% net imbalance of aggressive volume is a strong read.
  const score = clamp(ratio / 0.3);
  const who = ratio > 0.05 ? "Buyers are lifting offers" : ratio < -0.05 ? "Sellers are hitting bids" : "Aggression is balanced";
  return {
    ...base,
    available: true,
    score,
    value: `${fmtUsd(d5.net)} 5m · ${fmtUsd(d15.net)} 15m`,
    read: `${who} — ${Math.abs(Math.round(d15.ratio * 100))}% net ${d15.ratio >= 0 ? "buy" : "sell"} imbalance over 15m.`,
  };
}

/**
 * Absorption = effort vs result. Heavy one-sided aggression that does NOT
 * move price means a passive player is soaking it up — a reversal tell.
 * Only scores when aggression is meaningful AND price failed to follow.
 */
export function absorptionSignal(trades: Trade[], candles: Candle[], now: number): Signal {
  const base: Signal = { id: "absorption", label: "Absorption", weight: WEIGHTS.absorption, available: false, score: 0, value: "—", read: "" };
  const span = trades.length ? (now - trades[0].t) / 60_000 : 0;
  const windowMin = Math.min(15, span);
  if (windowMin < 3) return { ...base, why: "Needs ~3 min of tape to compare effort vs result." };
  const since = now - windowMin * 60_000;
  const d = deltaStats(trades, since);
  const p0 = priceAt(trades, since);
  const p1 = trades.length ? trades[trades.length - 1].px : null;
  const vol1m = oneMinuteVol(candles);
  if (!p0 || !p1 || vol1m <= 0 || d.n < 30) return { ...base, why: "Not enough data for a volatility baseline yet." };

  const ret = Math.log(p1 / p0);
  const z = ret / (vol1m * Math.sqrt(windowMin)); // price move in "expected moves"
  const effort = d.ratio;

  let score = 0;
  let read = "Price is responding normally to the aggression — no absorption.";
  if (Math.abs(effort) >= 0.12) {
    const followed = sign(z) === sign(effort) ? Math.abs(z) : -Math.abs(z);
    if (followed < 0.35) {
      // Aggression failed. Stronger when effort is bigger and price went the other way.
      const strength = clamp((Math.abs(effort) / 0.3) * (0.35 - followed) / 0.85, 0, 1);
      score = -sign(effort) * strength;
      read =
        effort > 0
          ? "Buyers are aggressing but price isn't lifting — passive sellers are absorbing. Bearish tell."
          : "Sellers are aggressing but price isn't dropping — passive buyers are absorbing. Bullish tell.";
    }
  } else {
    read = "Aggression too balanced to judge absorption.";
  }
  return {
    ...base,
    available: true,
    score,
    value: `${pct(ret * 100)} on ${effort >= 0 ? "+" : "−"}${Math.abs(Math.round(effort * 100))}% delta`,
    read,
  };
}

export function bookSignal(samples: BookSample[], now: number): Signal {
  const base: Signal = { id: "book", label: "Book imbalance", weight: WEIGHTS.book, available: false, score: 0, value: "—", read: "" };
  const recent = samples.filter((s) => s.t >= now - BOOK_WINDOW_MS);
  if (recent.length < 10) return { ...base, why: "Sampling the order book…" };
  // Time-average to blunt spoofed walls that flash in and out.
  const avg = recent.reduce((s, x) => s + x.imbalance, 0) / recent.length;
  const score = clamp(avg / 0.4);
  const side = avg > 0.08 ? "Bids are stacked deeper than asks" : avg < -0.08 ? "Asks are stacked deeper than bids" : "Book is roughly balanced";
  return {
    ...base,
    available: true,
    score,
    value: `${avg >= 0 ? "+" : "−"}${Math.abs(Math.round(avg * 100))}% (5m avg)`,
    read: `${side} within 0.5% of price. Resting orders can be pulled — treat as supporting evidence only.`,
  };
}

export function oiSignal(ctx: CtxSample[], now: number): Signal {
  const base: Signal = { id: "oi", label: "Open interest vs price", weight: WEIGHTS.oi, available: false, score: 0, value: "—", read: "" };
  if (ctx.length < 2) return { ...base, why: "Tracking OI — needs ~5 min of samples." };
  const windowStart = now - 60 * 60_000;
  const inWin = ctx.filter((c) => c.t >= windowStart);
  const first = inWin[0];
  const last = inWin[inWin.length - 1];
  if (!first || !last || last.t - first.t < 5 * 60_000) {
    return { ...base, why: "Tracking OI — needs ~5 min of samples." };
  }
  const dOi = ((last.oi - first.oi) / first.oi) * 100;
  const dPx = ((last.markPx - first.markPx) / first.markPx) * 100;
  const mins = Math.round((last.t - first.t) / 60_000);
  // Magnitude: 1% OI change in under an hour is meaningful, 3% is large.
  const mag = clamp(Math.abs(dOi) / 2, 0, 1);
  const pxMoved = Math.abs(dPx) >= 0.1;

  let score = 0;
  let read = "OI and price are flat — no clear positioning shift.";
  if (Math.abs(dOi) < 0.25) {
    read = "OI barely changed — moves are not being driven by new positions.";
  } else if (!pxMoved) {
    read = dOi > 0
      ? "OI is building while price goes nowhere — positions loading up, direction unresolved."
      : "OI is draining with price flat — positions closing, conviction fading.";
  } else if (dPx > 0 && dOi > 0) {
    score = mag;
    read = "Price up with rising OI — new longs are opening. Trend has fresh fuel.";
  } else if (dPx > 0 && dOi < 0) {
    score = 0.35 * mag;
    read = "Price up with falling OI — shorts covering. Rally is weaker than it looks.";
  } else if (dPx < 0 && dOi > 0) {
    score = -mag;
    read = "Price down with rising OI — new shorts are opening. Downside has fresh fuel.";
  } else {
    score = -0.35 * mag;
    read = "Price down with falling OI — longs closing/liquidating. Selling may exhaust.";
  }
  return { ...base, available: true, score, value: `OI ${pct(dOi)} · px ${pct(dPx)} (${mins}m)`, read };
}

export function whaleSignal(trades: Trade[], now: number, threshold: number): Signal {
  const base: Signal = { id: "whales", label: "Large prints", weight: WEIGHTS.whales, available: false, score: 0, value: "—", read: "" };
  const big = trades.filter((t) => t.t >= now - DELTA_WINDOW_MS && t.usd >= threshold);
  if (big.length < 3) {
    return { ...base, why: `Waiting for large prints (≥ ${fmtUsd(threshold).replace("+", "")}) — ${big.length} so far.` };
  }
  let net = 0;
  let total = 0;
  for (const t of big) {
    net += t.side * t.usd;
    total += t.usd;
  }
  const ratio = net / total;
  // Shrink toward 0 when there are only a handful of prints.
  const confidence = Math.min(1, big.length / 8);
  const score = clamp((ratio / 0.5) * confidence);
  return {
    ...base,
    available: true,
    score,
    value: `${big.length} prints · net ${fmtUsd(net)}`,
    read:
      ratio > 0.2
        ? "Size is buying aggressively — large players are on the bid."
        : ratio < -0.2
          ? "Size is selling aggressively — large players are on the offer."
          : "Large prints are mixed — no clear side from size.",
  };
}

export function crowdingSignal(ctx: CtxSample[]): Signal {
  const base: Signal = { id: "crowding", label: "Funding crowding", weight: WEIGHTS.crowding, available: false, score: 0, value: "—", read: "" };
  const last = ctx[ctx.length - 1];
  if (!last) return { ...base, why: "Loading funding…" };
  const f8h = last.fundingHourly * 8 * 100; // % per 8h. HL baseline ≈ 0.01%.
  let score = 0;
  let read = "Funding is near baseline — no crowding.";
  if (f8h > 0.03) {
    score = -clamp((f8h - 0.03) / 0.07, 0, 1);
    read = "Longs are paying up — crowded long side. Raises squeeze-down risk if flow turns.";
  } else if (f8h < -0.01) {
    score = clamp((-f8h - 0.01) / 0.05, 0, 1);
    read = "Shorts are paying — crowded short side. Raises squeeze-up risk if flow turns.";
  }
  return { ...base, available: true, score, value: `${f8h >= 0 ? "+" : "−"}${Math.abs(f8h).toFixed(4)}% / 8h`, read };
}

// ─── Aggregate ──────────────────────────────────────────────────

export interface EngineInput {
  trades: Trade[];
  book: BookSample[];
  ctx: CtxSample[];
  candles: Candle[];
  volume24hUsd: number;
  now: number;
}

export function computeBias(input: EngineInput): BiasResult {
  const { trades, book, ctx, candles, volume24hUsd, now } = input;
  const signals: Signal[] = [
    deltaSignal(trades, now),
    absorptionSignal(trades, candles, now),
    oiSignal(ctx, now),
    whaleSignal(trades, now, whaleThreshold(volume24hUsd)),
    bookSignal(book, now),
    crowdingSignal(ctx),
  ];

  // Absorption overrides aggression. If buyers are hammering offers and
  // price won't lift, that buying is the trapped side — it is NOT bullish
  // evidence. Discount delta and large prints by how strong the absorption is
  // (only when they point the same way as the failed effort).
  const absorb = signals.find((s) => s.id === "absorption");
  if (absorb?.available && Math.abs(absorb.score) >= 0.3) {
    const k = 1 - Math.min(1, Math.abs(absorb.score));
    for (const s of signals) {
      if ((s.id === "delta" || s.id === "whales") && s.available && sign(s.score) === -sign(absorb.score)) {
        s.score *= k;
        s.read += " Discounted: price isn't following this aggression (absorption).";
      }
    }
  }

  const totalW = signals.reduce((s, x) => s + x.weight, 0);
  const avail = signals.filter((s) => s.available);
  const availW = avail.reduce((s, x) => s + x.weight, 0);
  const raw = availW > 0 ? avail.reduce((s, x) => s + x.weight * x.score, 0) / availW : 0;
  const coverage = totalW > 0 ? availW / totalW : 0;

  // Don't let one or two signals produce a full-strength bias: scale by
  // coverage (sqrt so partial data still counts but is damped).
  const score = Math.round(clamp(raw * Math.sqrt(coverage)) * 100);

  const direction: BiasResult["direction"] =
    score >= NEUTRAL_BAND ? "long" : score <= -NEUTRAL_BAND ? "short" : "neutral";
  const strength: BiasResult["strength"] =
    Math.abs(score) >= STRONG_BAND ? "strong" : Math.abs(score) >= NEUTRAL_BAND ? "moderate" : "weak";

  const dir = sign(score);
  const agreeing = avail.filter((s) => dir !== 0 && sign(s.score) === dir && Math.abs(s.score) >= 0.15).length;
  const opposing = avail.filter((s) => dir !== 0 && sign(s.score) === -dir && Math.abs(s.score) >= 0.15).length;
  const agreement = agreeing + opposing > 0 ? agreeing / (agreeing + opposing) : 0;
  const confidence = Math.round(clamp(Math.abs(score) / 60, 0, 1) * coverage * (0.5 + 0.5 * agreement) * 100);

  const tapeMinutes = trades.length ? (now - trades[0].t) / 60_000 : 0;
  const warmingUp = tapeMinutes < WARMUP_MINUTES;

  return {
    score,
    direction,
    strength,
    confidence,
    coverage,
    agreeing,
    opposing,
    signals,
    summary: buildSummary(direction, avail),
    tapeMinutes,
    warmingUp,
  };
}

function buildSummary(direction: BiasResult["direction"], avail: Signal[]): string {
  const availW = avail.reduce((s, x) => s + x.weight, 0);
  if (avail.length === 0 || availW < 0.5) return "Reading the tape — not enough data for a bias yet.";
  const ranked = [...avail]
    .filter((s) => Math.abs(s.score) >= 0.15)
    .sort((a, b) => Math.abs(b.weight * b.score) - Math.abs(a.weight * a.score));
  if (direction === "neutral") {
    if (ranked.length >= 2 && sign(ranked[0].score) !== sign(ranked[1].score)) {
      return `Mixed: ${lower(ranked[0].label)} and ${lower(ranked[1].label)} disagree. No edge from flow right now.`;
    }
    return "Flow is balanced — no side has control. Standing aside is a position.";
  }
  const lead = ranked.filter((s) => sign(s.score) === (direction === "long" ? 1 : -1)).slice(0, 2);
  const against = ranked.find((s) => sign(s.score) === (direction === "long" ? -1 : 1));
  const side = direction === "long" ? "Buyers" : "Sellers";
  let out = `${side} have the edge`;
  if (lead.length) out += `, led by ${lead.map((s) => lower(s.label)).join(" and ")}`;
  out += ".";
  if (against) out += ` Watch ${lower(against.label)} — it's leaning the other way.`;
  return out;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
