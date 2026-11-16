// ════════════════════════════════════════════════════════════════
// Bias log — measures whether the bias is actually right.
//
// Every 5 minutes (while the Bias tab is open and warmed up) we record
// {coin, score, price}. 15 minutes later we check price. A directional
// call (|score| ≥ 20) is a hit if price moved its way. Neutral reads are
// not graded. Stored per-browser in localStorage — no backend needed.
//
// This is the honest answer to "do these weights work?": n and hit rate,
// on live data, shown in the UI. Small n means: don't trust it yet.
// ════════════════════════════════════════════════════════════════

export interface BiasLogEntry {
  t: number;
  coin: string;
  score: number;
  px: number;
  exitPx?: number;
  hit?: boolean;
}

const KEY = "mako:bias:log:v1";
export const LOG_EVERY_MS = 5 * 60_000;
export const HORIZON_MS = 15 * 60_000;
const MAX_ENTRIES = 2000;
const DIRECTIONAL = 20;

export function readLog(): BiasLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entries: BiasLogEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* storage full / disabled — logging is best-effort */
  }
}

/** Resolve due entries for `coin` at `px`, and append a new one if due. */
export function tickLog(coin: string, score: number, px: number, now: number): BiasLogEntry[] {
  const log = readLog();
  let changed = false;

  for (const e of log) {
    if (e.coin !== coin || e.exitPx !== undefined) continue;
    const age = now - e.t;
    if (age >= HORIZON_MS && age <= HORIZON_MS + 10 * 60_000) {
      e.exitPx = px;
      if (Math.abs(e.score) >= DIRECTIONAL) {
        e.hit = Math.sign(px - e.px) === Math.sign(e.score);
      }
      changed = true;
    } else if (age > HORIZON_MS + 10 * 60_000) {
      // Tab was closed through the horizon — can't grade fairly. Drop it.
      e.exitPx = NaN;
      changed = true;
    }
  }

  const lastForCoin = [...log].reverse().find((e) => e.coin === coin);
  if (!lastForCoin || now - lastForCoin.t >= LOG_EVERY_MS) {
    log.push({ t: now, coin, score, px });
    changed = true;
  }

  const cleaned = log.filter((e) => !(e.exitPx !== undefined && Number.isNaN(e.exitPx)));
  if (changed) writeLog(cleaned);
  return cleaned;
}

export interface LogStats {
  graded: number;
  hits: number;
  hitRate: number | null;
  pending: number;
}

export function logStats(log: BiasLogEntry[], coin?: string): LogStats {
  const rows = coin ? log.filter((e) => e.coin === coin) : log;
  const graded = rows.filter((e) => e.hit !== undefined);
  const hits = graded.filter((e) => e.hit).length;
  return {
    graded: graded.length,
    hits,
    hitRate: graded.length ? hits / graded.length : null,
    pending: rows.filter((e) => e.exitPx === undefined).length,
  };
}
