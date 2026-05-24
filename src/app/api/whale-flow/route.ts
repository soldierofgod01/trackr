// ═══════════════════════════════════════════════════════════════
// /api/whale-flow
//
// For each curated whale, hits Hyperliquid's free `clearinghouseState` and
// `userFills` endpoints to get current positions + recent fills. Aggregates
// into a "what are whales positioned in right now" summary per token.
//
// Rate limit consideration: HL doesn't publish a strict rate limit on these
// endpoints, but we throttle by fetching them in parallel rather than serial
// (5-10 parallel requests is fine for HL's infra).
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { WHALE_WALLETS, type WhaleWallet } from "@/lib/whale-flow/wallets";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const HL_API = "https://api.hyperliquid.xyz/info";

// ─── Hyperliquid response shapes ───

interface HLPosition {
  coin: string;
  szi: string;             // signed size (negative = short)
  entryPx: string | null;
  positionValue: string;
  unrealizedPnl: string;
  leverage: { type: string; value: number };
  liquidationPx: string | null;
  marginUsed: string;
  returnOnEquity: string;
}

interface HLAssetPosition {
  position: HLPosition;
  type: "oneWay";
}

interface HLClearinghouseState {
  assetPositions: HLAssetPosition[];
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  time: number;
}

interface HLFill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";          // B = buy, A = ask/sell
  time: number;             // ms timestamp
  startPosition: string;
  dir: string;              // "Open Long", "Close Long", etc.
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
}

// ─── Output shapes ───

interface WhalePositionSnapshot {
  whale: WhaleWallet;
  accountValueUsd: number;
  totalPositionNotional: number;
  positions: Array<{
    coin: string;
    side: "long" | "short";
    sizeCoin: number;
    notionalUsd: number;
    entryPrice: number | null;
    unrealizedPnl: number;
    leverage: number;
    roePct: number;
  }>;
  recentFills: Array<{
    coin: string;
    side: "buy" | "sell";
    price: number;
    sizeCoin: number;
    notionalUsd: number;
    direction: string;       // "Open Long" etc.
    closedPnl: number;
    timestamp: number;
  }>;
}

interface TokenAggregate {
  coin: string;
  netNotionalUsd: number;     // long - short across all whales
  longNotional: number;
  shortNotional: number;
  whaleCount: number;          // number of whales positioned
  avgRoePct: number;
  recentFillsCount24h: number;
  netFlow24hUsd: number;       // buys - sells in 24h
}

// ─── Helpers ───

async function fetchWhale(addr: string): Promise<{
  state: HLClearinghouseState | null;
  fills: HLFill[];
}> {
  try {
    const [stateRes, fillsRes] = await Promise.all([
      fetch(HL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: addr }),
      }),
      fetch(HL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "userFills", user: addr }),
      }),
    ]);

    if (!stateRes.ok || !fillsRes.ok) {
      return { state: null, fills: [] };
    }

    const state = (await stateRes.json()) as HLClearinghouseState;
    const fills = (await fillsRes.json()) as HLFill[];
    return { state, fills };
  } catch (e) {
    console.error(`Whale fetch failed for ${addr}:`, e);
    return { state: null, fills: [] };
  }
}

function normalizeWhale(
  whale: WhaleWallet,
  state: HLClearinghouseState,
  fills: HLFill[],
): WhalePositionSnapshot {
  const positions = state.assetPositions.map((ap) => {
    const sz = parseFloat(ap.position.szi);
    const notional = parseFloat(ap.position.positionValue);
    return {
      coin: ap.position.coin.toUpperCase(),
      side: (sz >= 0 ? "long" : "short") as "long" | "short",
      sizeCoin: Math.abs(sz),
      notionalUsd: notional,
      entryPrice: ap.position.entryPx ? parseFloat(ap.position.entryPx) : null,
      unrealizedPnl: parseFloat(ap.position.unrealizedPnl),
      leverage: ap.position.leverage.value,
      roePct: parseFloat(ap.position.returnOnEquity) * 100,
    };
  });

  // Take the most recent 50 fills only — anything older isn't useful "recent"
  const recentFills = fills.slice(0, 50).map((f) => {
    const px = parseFloat(f.px);
    const sz = parseFloat(f.sz);
    return {
      coin: f.coin.toUpperCase(),
      side: (f.side === "B" ? "buy" : "sell") as "buy" | "sell",
      price: px,
      sizeCoin: sz,
      notionalUsd: px * sz,
      direction: f.dir,
      closedPnl: parseFloat(f.closedPnl),
      timestamp: f.time,
    };
  });

  return {
    whale,
    accountValueUsd: parseFloat(state.marginSummary.accountValue),
    totalPositionNotional: parseFloat(state.marginSummary.totalNtlPos),
    positions,
    recentFills,
  };
}

function aggregateByToken(snapshots: WhalePositionSnapshot[]): TokenAggregate[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const tokenMap = new Map<string, TokenAggregate>();

  for (const snap of snapshots) {
    for (const pos of snap.positions) {
      let agg = tokenMap.get(pos.coin);
      if (!agg) {
        agg = {
          coin: pos.coin,
          netNotionalUsd: 0,
          longNotional: 0,
          shortNotional: 0,
          whaleCount: 0,
          avgRoePct: 0,
          recentFillsCount24h: 0,
          netFlow24hUsd: 0,
        };
        tokenMap.set(pos.coin, agg);
      }
      if (pos.side === "long") {
        agg.longNotional += pos.notionalUsd;
        agg.netNotionalUsd += pos.notionalUsd;
      } else {
        agg.shortNotional += pos.notionalUsd;
        agg.netNotionalUsd -= pos.notionalUsd;
      }
      agg.whaleCount += 1;
      agg.avgRoePct += pos.roePct;
    }

    for (const fill of snap.recentFills) {
      if (now - fill.timestamp > day) continue;
      let agg = tokenMap.get(fill.coin);
      if (!agg) {
        agg = {
          coin: fill.coin,
          netNotionalUsd: 0,
          longNotional: 0,
          shortNotional: 0,
          whaleCount: 0,
          avgRoePct: 0,
          recentFillsCount24h: 0,
          netFlow24hUsd: 0,
        };
        tokenMap.set(fill.coin, agg);
      }
      agg.recentFillsCount24h += 1;
      // Net flow: positive when buying, negative when selling
      agg.netFlow24hUsd += (fill.side === "buy" ? 1 : -1) * fill.notionalUsd;
    }
  }

  // Compute averages
  for (const agg of tokenMap.values()) {
    if (agg.whaleCount > 0) {
      agg.avgRoePct = agg.avgRoePct / agg.whaleCount;
    }
  }

  return Array.from(tokenMap.values()).sort(
    (a, b) => Math.abs(b.netNotionalUsd) - Math.abs(a.netNotionalUsd),
  );
}

// ─── Handler ───

export async function GET() {
  try {
    const results = await Promise.all(
      WHALE_WALLETS.map(async (w) => {
        const { state, fills } = await fetchWhale(w.address);
        if (!state) return null;
        return normalizeWhale(w, state, fills);
      }),
    );

    const snapshots = results.filter(
      (s): s is WhalePositionSnapshot => s !== null,
    );

    const tokenAggregates = aggregateByToken(snapshots);

    // Top 24h fills across all whales (flat list, sorted by recency)
    const recentTrades = snapshots
      .flatMap((s) =>
        s.recentFills.map((f) => ({
          whale: s.whale.alias,
          whaleAddress: s.whale.address,
          ...f,
        })),
      )
      .filter((f) => Date.now() - f.timestamp < 24 * 60 * 60 * 1000)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    return NextResponse.json({
      whaleCount: snapshots.length,
      whaleCountConfigured: WHALE_WALLETS.length,
      snapshots,
      tokenAggregates,
      recentTrades,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Whale flow API error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch whale flow",
        whaleCount: 0,
        whaleCountConfigured: WHALE_WALLETS.length,
        snapshots: [],
        tokenAggregates: [],
        recentTrades: [],
      },
      { status: 500 },
    );
  }
}
