"use client";
import { useEffect, useRef, useState } from "react";

// Binance miniTicker stream — all symbols, one batch message per second.
// Free, no auth, no rate limit for public market data.
// https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
//
// PERFORMANCE NOTE (v18 fix):
// The !miniTicker@arr stream pushes ~1400 pairs every second. Calling
// setState on every message rebuilt a 1400-key object and re-rendered the
// whole scanner once per second → visible lag.
//
// Fix: incoming ticks land in a ref buffer (no React render). A single
// interval flushes the buffer into state once per second. Smooth, live,
// no stutter.

interface MiniTicker {
  e: "24hrMiniTicker";
  E: number;
  s: string;       // symbol, e.g. "BTCUSDT"
  c: string;       // close (latest) price
  o: string;       // open
  h: string;
  l: string;
  v: string;
  q: string;
}

export interface LivePrice {
  price: number;
  prevPrice: number;
  ts: number;
}

const WS_URL = "wss://stream.binance.com:9443/ws/!miniTicker@arr";

function fromBinancePair(pair: string): string | null {
  if (!pair.endsWith("USDT")) return null;
  return pair.replace(/USDT$/, "");
}

/**
 * Live price stream. Returns a price map updated smoothly once per second.
 * NOTE: this intentionally does NOT expose 24h % change — that stays sourced
 * from the API so filters/sorts use consistent calendar-day numbers.
 */
export function usePriceStream() {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  // Buffer holds the latest raw price per symbol between flushes. Writing here
  // does NOT trigger a render — that's the whole point.
  const bufferRef = useRef<Record<string, number>>({});
  const hasNewDataRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    // ── Flush loop: once per second, move buffer → state ──
    const flushInterval = setInterval(() => {
      if (cancelled || !hasNewDataRef.current) return;
      hasNewDataRef.current = false;

      const buffer = bufferRef.current;
      setPrices((prev) => {
        const next: Record<string, LivePrice> = {};
        // Build fresh map: every symbol we've seen gets its latest price,
        // with prevPrice carried from the last flush (drives the tick color).
        for (const sym in buffer) {
          const newPrice = buffer[sym];
          const existing = prev[sym];
          next[sym] = {
            price: newPrice,
            prevPrice: existing ? existing.price : newPrice,
            ts: Date.now(),
          };
        }
        return next;
      });
    }, 1000);

    function connect() {
      if (cancelled) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) { ws.close(); return; }
          setStatus("live");
          reconnectAttemptRef.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!Array.isArray(data)) return;
            // Write straight to the buffer ref — no render here.
            const buf = bufferRef.current;
            for (const t of data as MiniTicker[]) {
              const sym = fromBinancePair(t.s);
              if (!sym) continue;
              buf[sym] = parseFloat(t.c);
            }
            hasNewDataRef.current = true;
          } catch {
            // Ignore parse errors — keep stream alive
          }
        };

        ws.onerror = () => setStatus("error");

        ws.onclose = () => {
          if (cancelled) return;
          setStatus("connecting");
          const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttemptRef.current));
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        };
      } catch {
        setStatus("error");
      }
    }

    connect();

    return () => {
      cancelled = true;
      clearInterval(flushInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return { prices, status };
}
