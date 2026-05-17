"use client";
import { useEffect, useRef, useState } from "react";

// Binance miniTicker stream — all symbols, one message per token per second.
// Free, no auth, no rate limit for public market data.
// https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams

interface MiniTicker {
  e: "24hrMiniTicker";
  E: number;       // event time
  s: string;       // symbol, e.g. "BTCUSDT"
  c: string;       // close (latest) price
  o: string;       // open
  h: string;       // high
  l: string;       // low
  v: string;       // base volume
  q: string;       // quote volume
}

export interface LivePrice {
  price: number;
  prevPrice: number;
  change24hPct: number;
  ts: number;
}

const WS_URL = "wss://stream.binance.com:9443/ws/!miniTicker@arr";

// Some tokens have different symbols on Binance vs CoinGecko
// Map CG symbol → Binance pair
const BINANCE_PAIR_OVERRIDES: Record<string, string> = {
  // Most are SYMBOL+USDT, but some need adjustment
  // (left empty for now; add when symbol mismatches surface)
};

function toBinancePair(symbol: string): string {
  return BINANCE_PAIR_OVERRIDES[symbol] ?? `${symbol}USDT`;
}

// Reverse lookup: Binance symbol → our display symbol
function fromBinancePair(pair: string): string | null {
  if (!pair.endsWith("USDT")) return null;
  return pair.replace(/USDT$/, "");
}

/**
 * Connects once on mount, maintains a live price map across all subscribed symbols.
 * Auto-reconnects with exponential backoff on disconnect.
 *
 * Returns: { prices: Record<symbol, LivePrice>, status: "connecting" | "live" | "error" }
 */
export function usePriceStream() {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
          setStatus("live");
          reconnectAttemptRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // miniTicker @arr is an array of tickers
            if (!Array.isArray(data)) return;

            setPrices((prev) => {
              const next = { ...prev };
              for (const t of data as MiniTicker[]) {
                const sym = fromBinancePair(t.s);
                if (!sym) continue;
                const price = parseFloat(t.c);
                const open = parseFloat(t.o);
                const change = open > 0 ? ((price - open) / open) * 100 : 0;
                const existing = prev[sym];
                next[sym] = {
                  price,
                  prevPrice: existing?.price ?? price,
                  change24hPct: change,
                  ts: Date.now(),
                };
              }
              return next;
            });
          } catch (err) {
            // Ignore parse errors — keep stream alive
            console.warn("ws parse err", err);
          }
        };

        ws.onerror = () => {
          setStatus("error");
        };

        ws.onclose = () => {
          if (cancelled) return;
          setStatus("connecting");
          // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
          const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttemptRef.current));
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        };
      } catch (err) {
        console.error("ws connect err", err);
        setStatus("error");
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;  // prevent reconnect
        wsRef.current.close();
      }
    };
  }, []);

  return { prices, status };
}

export { toBinancePair };
