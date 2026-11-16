"use client";
import { useEffect, useRef, useState } from "react";

// ════════════════════════════════════════════════════════════════
// Live price stream — Hyperliquid `allMids` WebSocket.
//
// v21 change: switched OFF Binance (wss://stream.binance.com). Binance's
// WebSocket is geo-restricted in some regions and was the suspected cause
// of the Scanner crash. Hyperliquid's own socket is consistent with the
// rest of the app's data and far less likely to be blocked.
//
// CRASH SAFETY: every part of this hook is wrapped so that ANY failure —
// blocked socket, throw in the constructor, bad message — results in an
// empty price map and status "error". It must NEVER throw, because a
// thrown error here would take down the whole Scanner page.
// ════════════════════════════════════════════════════════════════

export interface LivePrice {
  price: number;
  prevPrice: number;
  ts: number;
}

const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";

export function usePriceStream() {
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  // Latest price per symbol, buffered between flushes (no render on write).
  const bufferRef = useRef<Record<string, number>>({});
  const hasNewDataRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    // Guard: if the environment has no WebSocket at all, bail gracefully.
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      setStatus("error");
      return;
    }

    let cancelled = false;

    // ── Flush loop: once/sec, move buffer → state ──
    const flushInterval = setInterval(() => {
      if (cancelled || !hasNewDataRef.current) return;
      hasNewDataRef.current = false;
      const buffer = bufferRef.current;
      setPrices((prev) => {
        const next: Record<string, LivePrice> = {};
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
      let ws: WebSocket;
      try {
        ws = new WebSocket(HL_WS_URL);
      } catch {
        // Constructor itself threw (blocked URL, bad scheme, etc.)
        setStatus("error");
        return;
      }
      wsRef.current = ws;

      try {
        ws.onopen = () => {
          if (cancelled) {
            try { ws.close(); } catch { /* ignore */ }
            return;
          }
          setStatus("live");
          reconnectAttemptRef.current = 0;
          // Subscribe to allMids — all Hyperliquid mid prices
          try {
            ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
          } catch {
            // If subscribe fails, the socket is useless — let onclose retry
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            // allMids payload: { channel: "allMids", data: { mids: { COIN: "price" } } }
            if (msg?.channel !== "allMids" || !msg?.data?.mids) return;
            const mids = msg.data.mids as Record<string, string>;
            const buf = bufferRef.current;
            for (const sym in mids) {
              const p = parseFloat(mids[sym]);
              if (isFinite(p) && p > 0) buf[sym.toUpperCase()] = p;
            }
            hasNewDataRef.current = true;
          } catch {
            // Ignore any bad message — keep the stream alive
          }
        };

        ws.onerror = () => {
          // Don't throw — just mark error. onclose will handle reconnect.
          setStatus("error");
        };

        ws.onclose = () => {
          if (cancelled) return;
          setStatus("connecting");
          // Exponential backoff, capped at 30s. Stop after 6 attempts —
          // if it can't connect by then, the network is blocking it and
          // the Scanner just runs on API prices. No crash, no spam.
          if (reconnectAttemptRef.current >= 6) {
            setStatus("error");
            return;
          }
          const delay = Math.min(30_000, 1000 * Math.pow(2, reconnectAttemptRef.current));
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        };
      } catch {
        // Any failure wiring up handlers — degrade silently.
        setStatus("error");
      }
    }

    connect();

    return () => {
      cancelled = true;
      clearInterval(flushInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { prices, status };
}
