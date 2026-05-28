// ═══════════════════════════════════════════════════════════════
// Hyperliquid candleSnapshot — historical OHLC candles, one symbol at a time.
// Used for the on-demand sparkline when a Scanner row is expanded.
// We deliberately don't fetch this for all 179 rows up-front — only on click.
// ═══════════════════════════════════════════════════════════════

const HL_API = "https://api.hyperliquid.xyz/info";

interface HLCandle {
  t: number;  // start time (ms)
  T: number;  // end time (ms)
  s: string;  // symbol
  i: string;  // interval
  o: string;  // open
  c: string;  // close
  h: string;  // high
  l: string;  // low
  v: string;  // volume (coin)
  n: number;  // # of trades
}

export interface SparklinePoint {
  t: number;
  price: number;
}

/**
 * Fetch ~24h of hourly candles for a symbol and return a compact price series
 * suitable for a sparkline. 24 points, monotonic in time.
 */
export async function fetchSparkline24h(symbol: string): Promise<SparklinePoint[]> {
  const now = Date.now();
  const start = now - 24 * 60 * 60 * 1000;

  try {
    const res = await fetch(HL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "candleSnapshot",
        req: {
          coin: symbol,
          interval: "1h",
          startTime: start,
          endTime: now,
        },
      }),
      // Cache briefly — within a single render cycle, multiple expansions
      // of the same row should reuse the data
      next: { revalidate: 60 },
    });

    if (!res.ok) return [];

    const candles = (await res.json()) as HLCandle[];
    if (!Array.isArray(candles)) return [];

    return candles.map((c) => ({
      t: c.t,
      price: parseFloat(c.c),
    }));
  } catch {
    return [];
  }
}
