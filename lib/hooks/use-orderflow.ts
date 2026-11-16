"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  computeBias,
  type BiasResult,
  type BookSample,
  type Candle,
  type CtxSample,
  type Trade,
  whaleThreshold,
} from "@/lib/bias/engine";
import { tickLog, logStats, type LogStats } from "@/lib/bias/log";

// ════════════════════════════════════════════════════════════════
// useOrderflow(coin) — live order flow for one Hyperliquid perp.
//
// One WebSocket, two subscriptions (trades + l2Book) for the chosen coin,
// plus /api/bias polled every 15s for OI / funding / candles. Buffers live
// in refs; the engine runs once a second and pushes one render.
//
// CRASH SAFETY: same contract as usePriceStream — any socket failure ends
// in a status flag, never a thrown error.
// ════════════════════════════════════════════════════════════════

const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";
const TAPE_KEEP_MS = 60 * 60_000;
const BOOK_KEEP_MS = 15 * 60_000;
const CTX_KEEP_MS = 90 * 60_000;
const CVD_BUCKET_MS = 5_000;

export interface BiasCtx {
  markPx: number;
  oraclePx: number;
  oi: number;
  oiUsd: number;
  fundingHourly: number;
  premium: number;
  volume24hUsd: number;
  change24hPct: number;
  maxLeverage: number;
}

interface BiasApiResponse {
  coin: string;
  t: number;
  ctx: BiasCtx;
  candles: Candle[];
}

export interface CvdPoint {
  time: number; // seconds (lightweight-charts UTCTimestamp)
  cvd: number;  // cumulative net aggressive USD since session start
  px: number;
}

export interface BookLevel {
  px: number;
  usd: number;
}

export interface OrderflowState {
  status: "connecting" | "live" | "error";
  bias: BiasResult | null;
  ctx: BiasCtx | null;
  lastPx: number | null;
  cvd: CvdPoint[];
  bigPrints: Trade[];
  whaleMin: number;
  book: { bids: BookLevel[]; asks: BookLevel[]; bandPct: number } | null;
  tradeCount: number;
  logStats: LogStats | null;
  ctxError: boolean;
}

async function fetchBiasCtx(coin: string): Promise<BiasApiResponse> {
  const res = await fetch(`/api/bias?coin=${encodeURIComponent(coin)}`);
  if (!res.ok) throw new Error("bias ctx failed");
  return res.json();
}

/** Pick the finest aggregation whose 20 levels still cover ≥ 0.2% of price. */
export function pickSigFigs(price: number): number {
  if (!(price > 0)) return 4;
  const mag = Math.floor(Math.log10(price));
  for (const n of [5, 4, 3]) {
    const tick = Math.pow(10, mag - n + 1);
    if ((20 * tick) / price >= 0.002) return n;
  }
  return 3;
}

const EMPTY: OrderflowState = {
  status: "connecting",
  bias: null,
  ctx: null,
  lastPx: null,
  cvd: [],
  bigPrints: [],
  whaleMin: 25_000,
  book: null,
  tradeCount: 0,
  logStats: null,
  ctxError: false,
};

export function useOrderflow(coin: string): OrderflowState {
  const [state, setState] = useState<OrderflowState>(EMPTY);

  const tradesRef = useRef<Trade[]>([]);
  const bookRef = useRef<BookSample[]>([]);
  const lastBookRef = useRef<OrderflowState["book"]>(null);
  const ctxRef = useRef<CtxSample[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const cvdRef = useRef<CvdPoint[]>([]);
  const cvdTotalRef = useRef(0);
  const statusRef = useRef<OrderflowState["status"]>("connecting");
  const coinRef = useRef(coin);
  const sigFigsRef = useRef<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // ── Slow context: OI / funding / candles ─────────────────────────
  const ctxQuery = useQuery({
    queryKey: ["bias-ctx", coin],
    queryFn: () => fetchBiasCtx(coin),
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const d = ctxQuery.data;
    if (!d || d.coin !== coinRef.current) return;
    const arr = ctxRef.current;
    if (!arr.length || arr[arr.length - 1].t !== d.t) {
      arr.push({ t: d.t, markPx: d.ctx.markPx, oi: d.ctx.oi, fundingHourly: d.ctx.fundingHourly });
      const cut = Date.now() - CTX_KEEP_MS;
      while (arr.length && arr[0].t < cut) arr.shift();
    }
    if (d.candles.length) candlesRef.current = d.candles.slice(-60);

    // First price for this coin → now we know how to aggregate the book.
    if (sigFigsRef.current === null && d.ctx.markPx > 0) {
      sigFigsRef.current = pickSigFigs(d.ctx.markPx);
      subscribeBook();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxQuery.data]);

  function send(msg: object) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
    }
  }

  function subscribeBook() {
    if (sigFigsRef.current === null) return;
    send({
      method: "subscribe",
      subscription: { type: "l2Book", coin: coinRef.current, nSigFigs: sigFigsRef.current },
    });
  }

  // ── Reset buffers + (re)subscribe when the coin changes ──────────
  useEffect(() => {
    const prev = coinRef.current;
    const prevSig = sigFigsRef.current;
    if (prev !== coin) {
      send({ method: "unsubscribe", subscription: { type: "trades", coin: prev } });
      if (prevSig !== null) {
        send({ method: "unsubscribe", subscription: { type: "l2Book", coin: prev, nSigFigs: prevSig } });
      }
    }
    coinRef.current = coin;
    sigFigsRef.current = null;
    tradesRef.current = [];
    bookRef.current = [];
    lastBookRef.current = null;
    ctxRef.current = [];
    candlesRef.current = [];
    cvdRef.current = [];
    cvdTotalRef.current = 0;
    setState({ ...EMPTY, status: statusRef.current });
    send({ method: "subscribe", subscription: { type: "trades", coin } });
    // Book subscribes once /api/bias tells us the price (see effect above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin]);

  // ── WebSocket lifecycle (once per mount) ─────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      statusRef.current = "error";
      return;
    }
    let cancelled = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    function onTrades(data: unknown) {
      if (!Array.isArray(data)) return;
      const buf = tradesRef.current;
      for (const raw of data as { coin: string; side: string; px: string; sz: string; time: number }[]) {
        if (raw?.coin !== coinRef.current) continue;
        const px = parseFloat(raw.px);
        const sz = parseFloat(raw.sz);
        if (!(px > 0) || !(sz > 0)) continue;
        const side: 1 | -1 = raw.side === "B" ? 1 : -1;
        const tr: Trade = { t: raw.time, px, sz, usd: px * sz, side };
        // Keep the tape time-ordered even if a batch arrives late.
        if (buf.length && tr.t < buf[buf.length - 1].t) {
          let i = buf.length - 1;
          while (i > 0 && buf[i - 1].t > tr.t) i--;
          buf.splice(i, 0, tr);
        } else {
          buf.push(tr);
        }
        cvdTotalRef.current += side * tr.usd;

        const bucketT = Math.floor(tr.t / CVD_BUCKET_MS) * CVD_BUCKET_MS;
        const cvd = cvdRef.current;
        const last = cvd[cvd.length - 1];
        const time = bucketT / 1000;
        if (last && last.time === time) {
          last.cvd = cvdTotalRef.current;
          last.px = px;
        } else if (!last || time > last.time) {
          cvd.push({ time, cvd: cvdTotalRef.current, px });
        }
      }
      const cut = Date.now() - TAPE_KEEP_MS;
      while (buf.length && buf[0].t < cut) buf.shift();
      const cvd = cvdRef.current;
      while (cvd.length && cvd[0].time * 1000 < cut) cvd.shift();
    }

    function onBook(data: unknown) {
      const d = data as { coin?: string; time?: number; levels?: { px: string; sz: string }[][] };
      if (!d || d.coin !== coinRef.current || !Array.isArray(d.levels) || d.levels.length < 2) return;
      const bidsRaw = d.levels[0] ?? [];
      const asksRaw = d.levels[1] ?? [];
      if (!bidsRaw.length || !asksRaw.length) return;
      const bestBid = parseFloat(bidsRaw[0].px);
      const bestAsk = parseFloat(asksRaw[0].px);
      const mid = (bestBid + bestAsk) / 2;
      if (!(mid > 0)) return;

      const toLv = (l: { px: string; sz: string }) => {
        const px = parseFloat(l.px);
        return { px, usd: px * parseFloat(l.sz) };
      };
      const bids = bidsRaw.map(toLv);
      const asks = asksRaw.map(toLv);
      // Band = 0.5% or as deep as the 20 visible levels reach, whichever is tighter.
      const reachBid = (mid - bids[bids.length - 1].px) / mid;
      const reachAsk = (asks[asks.length - 1].px - mid) / mid;
      const band = Math.min(0.005, reachBid, reachAsk);
      const bidUsd = bids.filter((l) => (mid - l.px) / mid <= band).reduce((s, l) => s + l.usd, 0);
      const askUsd = asks.filter((l) => (l.px - mid) / mid <= band).reduce((s, l) => s + l.usd, 0);
      const tot = bidUsd + askUsd;
      lastBookRef.current = { bids: bids.slice(0, 12), asks: asks.slice(0, 12), bandPct: band * 100 };
      if (tot <= 0) return;

      const now = d.time ?? Date.now();
      const samples = bookRef.current;
      // HL pushes the book often; one sample per second is plenty.
      if (samples.length && now - samples[samples.length - 1].t < 1000) return;
      samples.push({ t: now, imbalance: (bidUsd - askUsd) / tot, bidUsd, askUsd });
      const cut = Date.now() - BOOK_KEEP_MS;
      while (samples.length && samples[0].t < cut) samples.shift();
    }

    function connect() {
      if (cancelled) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(HL_WS_URL);
      } catch {
        statusRef.current = "error";
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { try { ws.close(); } catch { /* ignore */ } return; }
        attempt = 0;
        statusRef.current = "live";
        send({ method: "subscribe", subscription: { type: "trades", coin: coinRef.current } });
        subscribeBook();
        if (pingTimer) clearInterval(pingTimer);
        // HL drops sockets idle for 60s; quiet alts can go that long without a trade.
        pingTimer = setInterval(() => send({ method: "ping" }), 30_000);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.channel === "trades") onTrades(msg.data);
          else if (msg?.channel === "l2Book") onBook(msg.data);
        } catch { /* ignore bad frame */ }
      };
      ws.onerror = () => { statusRef.current = "error"; };
      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        if (cancelled) return;
        statusRef.current = "connecting";
        if (attempt >= 8) { statusRef.current = "error"; return; }
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      const ws = wsRef.current;
      if (ws) { try { ws.onclose = null; ws.close(); } catch { /* ignore */ } }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Engine tick: once per second ─────────────────────────────────
  const ctxData = ctxQuery.data && ctxQuery.data.coin === coin ? ctxQuery.data.ctx : null;
  const ctxError = ctxQuery.isError;
  const ctxDataRef = useRef(ctxData);
  ctxDataRef.current = ctxData;
  const ctxErrorRef = useRef(ctxError);
  ctxErrorRef.current = ctxError;

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const now = Date.now();
        const trades = tradesRef.current;
        const ctx = ctxDataRef.current;
        const vol = ctx?.volume24hUsd ?? 0;
        const bias = computeBias({
          trades,
          book: bookRef.current,
          ctx: ctxRef.current,
          candles: candlesRef.current,
          volume24hUsd: vol,
          now,
        });
        const lastPx = trades.length ? trades[trades.length - 1].px : ctx?.markPx ?? null;
        const whaleMin = whaleThreshold(vol);

        let stats: LogStats | null = null;
        if (!bias.warmingUp && lastPx && typeof window !== "undefined") {
          const log = tickLog(coinRef.current, bias.score, lastPx, now);
          stats = logStats(log, coinRef.current);
        }

        setState({
          status: statusRef.current,
          bias,
          ctx,
          lastPx,
          cvd: cvdRef.current.slice(),
          bigPrints: trades.filter((t) => t.usd >= whaleMin).slice(-25).reverse(),
          whaleMin,
          book: lastBookRef.current,
          tradeCount: trades.length,
          logStats: stats,
          ctxError: ctxErrorRef.current,
        });
      } catch {
        /* never let the engine take the page down */
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
