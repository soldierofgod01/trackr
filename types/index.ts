// ═══════════════════════════════════════════════════════════════
// CRYPTO TRACKR — Type Definitions
// ═══════════════════════════════════════════════════════════════

export type Chain = "ethereum" | "solana" | "base" | "arbitrum" | "optimism" | "hyperliquid" | "binance" | "bybit";
export type Venue = "spot" | "perp";
export type SkillTier = "diamond" | "platinum" | "gold" | "silver" | "bronze";

// ── TOKEN / MARKET ────────────────────────────────────

export interface TokenInfo {
  symbol: string;
  name: string;
  chain: Chain;
  iconUrl?: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange7d: number;
  marketCapUsd: number;
  volume24h: number;
  liquidityUsd?: number;
}

// ── PORTFOLIO ─────────────────────────────────────────

export interface Position {
  id: string;
  symbol: string;
  tokenName: string;
  chain: Chain;
  venue: Venue;
  side: "long" | "short";
  size: number;
  sizeUsd: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  leverage?: number;
  liquidationPrice?: number;
  marginUsed?: number;
  fundingPaid?: number;
  category: string;
  daysHeld: number;
  openedAt?: string;
}

// ── PLAN (discipline layer) ──────────────────────────

export interface TradePlan {
  id: string;
  positionId?: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  sizeUsd: number;
  thesis: string;
  status: "active" | "hit_target" | "hit_stop" | "drifted" | "closed";
  createdAt: string;
  closedAt?: string;
  closedPrice?: number;
  followedPlan?: boolean;
  thesisPlayedOut?: boolean;
}

// ── CALIBRATION ───────────────────────────────────────

export interface CalibrationBucket {
  range: [number, number];
  midpoint: number;
  actualWinRate: number;
  sampleCount: number;
}

// ── RISK ──────────────────────────────────────────────

export interface CategoryExposure {
  category: string;
  pct: number;
  usd: number;
  color: string;
}

export interface CorrelationCell {
  symbolA: string;
  symbolB: string;
  correlation: number;
}

export interface LiquidationRisk {
  positionId: string;
  symbol: string;
  currentPrice: number;
  liquidationPrice: number;
  distancePct: number;
  riskLevel: "safe" | "watch" | "danger";
}

// ── PORTFOLIO INSIGHTS ────────────────────────────────

export interface PortfolioInsight {
  kind: "edge" | "watch" | "warn";
  title: string;
  body: string;
  link?: { label: string; view: string };
}

// ── SCANNER ───────────────────────────────────────────

export type ScannerScreen =
  | "all"
  | "hot"
  | "breakout"
  | "oversold"
  | "smart_money"
  | "new_listings";

export interface ScannerToken extends TokenInfo {
  // Perp metrics (zero for spot-only tokens)
  openInterestUsd: number;
  openInterestChange24h: number;
  fundingRate8h: number;        // expressed as percent (e.g. 0.012 means 0.012%)
  sparkline7d: number[];
  category: string;
}

// ── RADAR (v2) ────────────────────────────────────────

export interface TrackedWallet {
  address: string;
  shortAddress: string;
  label?: string;
  tier: SkillTier;
  skillScore: number;
  pnl30d: number;
  winRate: number;
  roi30d: number;
  activePositions: number;
  lastTradeAt: string;
  chains: Chain[];
}

export interface SmartTrade {
  id: string;
  wallet: TrackedWallet;
  symbol: string;
  side: "long" | "short";
  action: "bought" | "sold";
  sizeUsd: number;
  price: number;
  timestamp: string;
}

// ── ALERTS ────────────────────────────────────────────

export type AlertKind =
  | "price"
  | "target_hit"
  | "stop_hit"
  | "liq_warning"
  | "smart_money"
  | "drift";

export interface Alert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  symbol?: string;
  severity: "info" | "warn" | "danger";
  createdAt: string;
  read: boolean;
}

// ── FILTER STATE ──────────────────────────────────────

export interface FilterState {
  tier: SkillTier | "all";
  category: string;
  minTradeSize: number;
  side: "all" | "long" | "short";
}

export type RadarView = "leaderboard" | "feed" | "consensus";

// ── BACKWARD-COMPAT (kept so radar code doesn't break in v1) ──
export type WalletTier = SkillTier;
export type MarketConsensus = unknown;
export type ResolutionEvent = unknown;
