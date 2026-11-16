// ═══════════════════════════════════════════════════════════════
// CRYPTO TRACKR — Mock Data
// ═══════════════════════════════════════════════════════════════

import type {
  Position,
  CalibrationBucket,
  CategoryExposure,
  PortfolioInsight,
  ScannerToken,
  TrackedWallet,
  SmartTrade,
  TradePlan,
  Alert,
  Chain,
} from "@/types";

// ── PORTFOLIO ─────────────────────────────────────────

export const MOCK_POSITIONS: Position[] = [
  {
    id: "p1",
    symbol: "BTC",
    tokenName: "Bitcoin",
    chain: "binance",
    venue: "spot",
    side: "long",
    size: 0.142,
    sizeUsd: 12780,
    entryPrice: 78400,
    currentPrice: 90000,
    unrealizedPnlUsd: 1647,
    unrealizedPnlPct: 14.8,
    category: "Major",
    daysHeld: 22,
  },
  {
    id: "p2",
    symbol: "ETH",
    tokenName: "Ethereum",
    chain: "ethereum",
    venue: "spot",
    side: "long",
    size: 2.4,
    sizeUsd: 8160,
    entryPrice: 3850,
    currentPrice: 3400,
    unrealizedPnlUsd: -1080,
    unrealizedPnlPct: -11.7,
    category: "Major",
    daysHeld: 45,
  },
  {
    id: "p3",
    symbol: "SOL",
    tokenName: "Solana",
    chain: "solana",
    venue: "spot",
    side: "long",
    size: 28,
    sizeUsd: 5460,
    entryPrice: 165,
    currentPrice: 195,
    unrealizedPnlUsd: 840,
    unrealizedPnlPct: 18.2,
    category: "Alt L1",
    daysHeld: 12,
  },
  {
    id: "p4",
    symbol: "ETH-PERP",
    tokenName: "Ethereum Perpetual",
    chain: "hyperliquid",
    venue: "perp",
    side: "long",
    size: 1.5,
    sizeUsd: 5100,
    entryPrice: 3300,
    currentPrice: 3400,
    unrealizedPnlUsd: 150,
    unrealizedPnlPct: 2.9,
    leverage: 5,
    liquidationPrice: 2820,
    marginUsed: 1020,
    fundingPaid: -42,
    category: "Major",
    daysHeld: 4,
  },
  {
    id: "p5",
    symbol: "WIF",
    tokenName: "dogwifhat",
    chain: "solana",
    venue: "spot",
    side: "long",
    size: 4200,
    sizeUsd: 3360,
    entryPrice: 0.95,
    currentPrice: 0.80,
    unrealizedPnlUsd: -630,
    unrealizedPnlPct: -15.8,
    category: "Memecoin",
    daysHeld: 18,
  },
  {
    id: "p6",
    symbol: "BTC-PERP",
    tokenName: "Bitcoin Perpetual",
    chain: "hyperliquid",
    venue: "perp",
    side: "short",
    size: 0.05,
    sizeUsd: 4500,
    entryPrice: 92000,
    currentPrice: 90000,
    unrealizedPnlUsd: 100,
    unrealizedPnlPct: 2.2,
    leverage: 10,
    liquidationPrice: 100100,
    marginUsed: 450,
    fundingPaid: 28,
    category: "Major",
    daysHeld: 2,
  },
  {
    id: "p7",
    symbol: "ARB",
    tokenName: "Arbitrum",
    chain: "arbitrum",
    venue: "spot",
    side: "long",
    size: 1850,
    sizeUsd: 1665,
    entryPrice: 1.10,
    currentPrice: 0.90,
    unrealizedPnlUsd: -370,
    unrealizedPnlPct: -18.2,
    category: "Alt L1",
    daysHeld: 60,
  },
];

export const MOCK_PORTFOLIO_SUMMARY = {
  totalValue: 41025,
  totalValueDelta: 320,
  totalValueDeltaPct: 0.8,
  totalPnl: 657,
  realizedPnl: -2200,
  unrealizedPnl: 2857,
  totalPnlPct: 1.6,
  winRate: 64,
  winsCount: 16,
  resolvedCount: 25,
  roi: 8.4,
  roiRankPctile: 38,
  exposureUsd: 41025,
  activePositions: 7,
  bestPositionUsd: 1647,
  bestPositionName: "BTC",
  skillScore: 71,
  skillRank: 412,
  totalWallets: 5000,
  avgHoldDays: 23,
  medianHoldDays: 18,
  walletAddress: "0x7f3a4b2c9d1e5f8a2b4c6d9e1f3a5b7c9d1eb81e",
};

export const MOCK_EXPOSURE: CategoryExposure[] = [
  { category: "Major (BTC/ETH)", pct: 49, usd: 20100, color: "#F7931A" },
  { category: "Alt L1", pct: 18, usd: 7400, color: "#9945FF" },
  { category: "Perp positions", pct: 23, usd: 9450, color: "#3B82F6" },
  { category: "Memecoin", pct: 8, usd: 3360, color: "#EF4444" },
  { category: "DeFi", pct: 2, usd: 715, color: "#10B981" },
];

// ── CALIBRATION ───────────────────────────────────────
// For crypto: bucket based on conviction level at entry vs actual outcome
export const MOCK_CALIBRATION: CalibrationBucket[] = [
  { range: [0, 20], midpoint: 10, actualWinRate: 12, sampleCount: 5 },
  { range: [20, 40], midpoint: 30, actualWinRate: 35, sampleCount: 7 },
  { range: [40, 60], midpoint: 50, actualWinRate: 64, sampleCount: 8 },
  { range: [60, 80], midpoint: 70, actualWinRate: 71, sampleCount: 4 },
  { range: [80, 100], midpoint: 90, actualWinRate: 100, sampleCount: 1 },
];

// ── INSIGHTS ──────────────────────────────────────────

export const MOCK_INSIGHTS: PortfolioInsight[] = [
  {
    kind: "warn",
    title: "Liquidation watch: ETH-PERP",
    body: "Your 5x ETH long is 17% from liq at $2,820. ETH is in a 12% drawdown from local high.",
    link: { label: "See risk", view: "risk" },
  },
  {
    kind: "edge",
    title: "Best discipline streak: 8 trades",
    body: "You've followed your plan on the last 8 closed trades and won 6 of them.",
  },
];

// ── SCANNER ───────────────────────────────────────────

function genSparkline(direction: number = 0, points = 24): number[] {
  const pts: number[] = [];
  let v = 0.5;
  for (let i = 0; i < points; i++) {
    v += (Math.random() - 0.5 + direction * 0.04) * 0.06;
    v = Math.max(0.1, Math.min(0.9, v));
    pts.push(Math.round(v * 1000) / 1000);
  }
  return pts;
}

const cryptoTokens = [
  { sym: "BTC", name: "Bitcoin", chain: "binance" as Chain, cat: "Major", price: 90000, mcap: 1_780_000_000_000 },
  { sym: "ETH", name: "Ethereum", chain: "ethereum" as Chain, cat: "Major", price: 3400, mcap: 410_000_000_000 },
  { sym: "SOL", name: "Solana", chain: "solana" as Chain, cat: "Alt L1", price: 195, mcap: 92_000_000_000 },
  { sym: "BNB", name: "BNB", chain: "binance" as Chain, cat: "Alt L1", price: 642, mcap: 94_000_000_000 },
  { sym: "XRP", name: "Ripple", chain: "ethereum" as Chain, cat: "Major", price: 2.40, mcap: 138_000_000_000 },
  { sym: "DOGE", name: "Dogecoin", chain: "ethereum" as Chain, cat: "Memecoin", price: 0.32, mcap: 47_000_000_000 },
  { sym: "ADA", name: "Cardano", chain: "ethereum" as Chain, cat: "Alt L1", price: 0.78, mcap: 28_000_000_000 },
  { sym: "AVAX", name: "Avalanche", chain: "ethereum" as Chain, cat: "Alt L1", price: 38, mcap: 15_700_000_000 },
  { sym: "LINK", name: "Chainlink", chain: "ethereum" as Chain, cat: "DeFi", price: 23, mcap: 14_400_000_000 },
  { sym: "TON", name: "Toncoin", chain: "ethereum" as Chain, cat: "Alt L1", price: 5.40, mcap: 13_700_000_000 },
  { sym: "SUI", name: "Sui", chain: "solana" as Chain, cat: "Alt L1", price: 4.20, mcap: 12_000_000_000 },
  { sym: "HYPE", name: "Hyperliquid", chain: "hyperliquid" as Chain, cat: "DeFi", price: 31, mcap: 10_400_000_000 },
  { sym: "WIF", name: "dogwifhat", chain: "solana" as Chain, cat: "Memecoin", price: 0.80, mcap: 800_000_000 },
  { sym: "PEPE", name: "Pepe", chain: "ethereum" as Chain, cat: "Memecoin", price: 0.0000088, mcap: 3_700_000_000 },
  { sym: "BONK", name: "Bonk", chain: "solana" as Chain, cat: "Memecoin", price: 0.000018, mcap: 1_400_000_000 },
  { sym: "ARB", name: "Arbitrum", chain: "arbitrum" as Chain, cat: "Alt L1", price: 0.90, mcap: 4_400_000_000 },
  { sym: "OP", name: "Optimism", chain: "optimism" as Chain, cat: "Alt L1", price: 1.85, mcap: 2_100_000_000 },
  { sym: "AAVE", name: "Aave", chain: "ethereum" as Chain, cat: "DeFi", price: 240, mcap: 3_600_000_000 },
  { sym: "UNI", name: "Uniswap", chain: "ethereum" as Chain, cat: "DeFi", price: 9.80, mcap: 5_900_000_000 },
  { sym: "FET", name: "Fetch.ai", chain: "ethereum" as Chain, cat: "AI", price: 1.42, mcap: 3_400_000_000 },
  { sym: "RNDR", name: "Render", chain: "ethereum" as Chain, cat: "AI", price: 7.20, mcap: 3_700_000_000 },
];

export const MOCK_SCANNER_TOKENS: ScannerToken[] = cryptoTokens.map((t) => {
  const change24 = (Math.random() - 0.45) * 25;
  const change7 = (Math.random() - 0.4) * 50;
  const volume = Math.round(t.mcap * (0.01 + Math.random() * 0.08));

  // OI is roughly 1-5% of market cap for active perp tokens, 0 for spot-only
  const hasPerps = ["BTC", "ETH", "SOL", "ARB", "OP", "AVAX", "SUI", "DOGE", "WIF", "PEPE", "BONK", "HYPE", "LINK"].includes(t.sym);
  const oiUsd = hasPerps ? Math.round(t.mcap * (0.005 + Math.random() * 0.04)) : 0;
  const oiChange = hasPerps ? Math.round((Math.random() - 0.4) * 30 * 10) / 10 : 0;
  // Funding tends to be positive when price up, negative when price down
  const funding = hasPerps ? Math.round((change24 / 25 + (Math.random() - 0.5) * 0.4) * 1000) / 1000 : 0;

  return {
    symbol: t.sym,
    name: t.name,
    chain: t.chain,
    priceUsd: t.price,
    priceChange24h: Math.round(change24 * 10) / 10,
    priceChange7d: Math.round(change7 * 10) / 10,
    marketCapUsd: t.mcap,
    volume24h: volume,
    openInterestUsd: oiUsd,
    openInterestChange24h: oiChange,
    fundingRate8h: funding,
    sparkline7d: genSparkline(change7 > 0 ? 1 : -1),
    category: t.cat,
  };
});

// ── PLANS (discipline layer mock) ────────────────────

export const MOCK_PLANS: TradePlan[] = [
  {
    id: "plan-1",
    positionId: "p1",
    symbol: "BTC",
    side: "long",
    entryPrice: 78400,
    targetPrice: 95000,
    stopPrice: 72000,
    sizeUsd: 12780,
    thesis: "ETF inflows accelerating + Fed cut cycle = continuation higher",
    status: "active",
    createdAt: "2026-04-18T10:00:00Z",
  },
  {
    id: "plan-2",
    positionId: "p3",
    symbol: "SOL",
    side: "long",
    entryPrice: 165,
    targetPrice: 220,
    stopPrice: 145,
    sizeUsd: 5460,
    thesis: "Solana DeFi TVL recovering, retail attention rotating in",
    status: "active",
    createdAt: "2026-04-29T14:00:00Z",
  },
];

// ── RADAR (v2 placeholder, kept so component imports don't break) ─

export const MOCK_WALLETS: TrackedWallet[] = [];
export const MOCK_TRADES: SmartTrade[] = [];
export const MOCK_CONSENSUS: unknown[] = [];

// ── ALERTS ────────────────────────────────────────────

export const MOCK_ALERTS: Alert[] = [
  {
    id: "a1",
    kind: "liq_warning",
    title: "ETH-PERP near liquidation",
    body: "Your 5x ETH long is 17% from liq at $2,820",
    symbol: "ETH",
    severity: "warn",
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    read: false,
  },
  {
    id: "a2",
    kind: "target_hit",
    title: "BTC hit target zone",
    body: "BTC is 5% from your $95k target — review plan",
    symbol: "BTC",
    severity: "info",
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    read: false,
  },
  {
    id: "a3",
    kind: "drift",
    title: "WIF: 18 days past max hold",
    body: "Your plan said 14 days max, you're at 18 with -16% P&L",
    symbol: "WIF",
    severity: "warn",
    createdAt: new Date(Date.now() - 12 * 3600_000).toISOString(),
    read: true,
  },
];

// ── PORTFOLIO VALUE TIME SERIES ──────────────────────

export function generatePortfolioSeries(days: number = 60): { day: number; value: number }[] {
  const pts: { day: number; value: number }[] = [];
  let cumulative = 38000;
  for (let i = 0; i <= days; i++) {
    const drift = 50 + Math.sin(i / 7) * 80 + Math.sin(i * 1.7) * 35;
    cumulative += drift;
    pts.push({ day: i, value: Math.round(cumulative) });
  }
  return pts;
}

// ── BACKWARD-COMPAT EXPORTS (so old radar/scanner imports don't break compile) ─
export const MOCK_SCANNER_MARKETS = MOCK_SCANNER_TOKENS;
export function generatePnlSeries(days: number = 60) {
  return generatePortfolioSeries(days);
}

// ── RISK MODULE MOCKS ─────────────────────────────────

// Correlation matrix: tokens you hold vs each other (7-day price correlation)
export const MOCK_CORRELATIONS_MARKETS = ["BTC", "ETH", "SOL", "ETH-PERP", "WIF", "BTC-PERP", "ARB"];
export const MOCK_CORRELATION_MATRIX: number[][] = [
  // BTC    ETH    SOL    ETH-P  WIF    BTC-P  ARB
  [ 1.00,  0.82,  0.74,  0.81, 0.55, -0.91,  0.62], // BTC
  [ 0.82,  1.00,  0.78,  0.97, 0.58, -0.78,  0.71], // ETH
  [ 0.74,  0.78,  1.00,  0.76, 0.69, -0.71,  0.66], // SOL
  [ 0.81,  0.97,  0.76,  1.00, 0.56, -0.77,  0.69], // ETH-PERP (highly corr with ETH)
  [ 0.55,  0.58,  0.69,  0.56, 1.00, -0.49,  0.51], // WIF
  [-0.91, -0.78, -0.71, -0.77,-0.49,  1.00, -0.58], // BTC-PERP (short → negative)
  [ 0.62,  0.71,  0.66,  0.69, 0.51, -0.58,  1.00], // ARB
];

// Stress scenarios — what happens to portfolio under each
export const MOCK_STRESS = [
  { id: "s1", scenario: "BTC -15%",          lossUsd: -8420, lossPct: -20.5, description: "BTC flash crash, alts amplify" },
  { id: "s2", scenario: "ETH -20%",          lossUsd: -4900, lossPct: -11.9, description: "ETH-led correction" },
  { id: "s3", scenario: "Memecoin -50%",     lossUsd: -1680, lossPct: -4.1,  description: "Memecoin sector wipe" },
  { id: "s4", scenario: "Total liquidation", lossUsd: -1470, lossPct: -3.6,  description: "Both perp positions hit liq" },
  { id: "s5", scenario: "Risk-off, BTC -8%", lossUsd: -3200, lossPct: -7.8,  description: "Macro shock, broad pullback" },
];

// Hedge suggestions — adapted for crypto (perp shorts, sector rotation)
export const MOCK_HEDGES = [
  {
    marketId: "h1",
    marketName: "Open BTC short on Hyperliquid",
    category: "Perp hedge",
    side: "short",
    suggestedSizeUsd: 5000,
    reason: "Your portfolio has 0.78 avg corr to BTC. A 1x BTC short of $5k offsets ~40% of your downside.",
    impactSummary: "Reduces stress-test loss from -$8.4k to -$5.0k",
    sizeUsd: 5000,
    expectedOffset: 0.40,
  },
  {
    marketId: "h2",
    marketName: "Reduce ETH-PERP leverage 5x → 2x",
    category: "Risk reduction",
    side: "long",
    suggestedSizeUsd: 0,
    reason: "Same exposure, 60% lower liquidation risk. Liq distance goes from 17% to 42%.",
    impactSummary: "Liq distance: 17% → 42%",
    sizeUsd: 0,
    expectedOffset: 0.0,
  },
  {
    marketId: "h3",
    marketName: "Trim WIF position by 50%",
    category: "Plan drift",
    side: "short",
    suggestedSizeUsd: 1680,
    reason: "Memecoin position is largest underperformer (-15.8%). Plan said 14d max, you're at 18d.",
    impactSummary: "Frees $1.7k, removes drift",
    sizeUsd: -1680,
    expectedOffset: 0.0,
  },
];

// EV (Expected Value) — for crypto, this is target-based: P(target hit) × payoff vs P(stop hit) × loss
export const MOCK_EV = [
  {
    marketId: "ev1",
    marketName: "BTC plan: $78.4k → $95k target",
    entryPrice: 78400,
    smartMoneyProb: 0.62,    // probability target hits before stop
    edgePct: 6.4,            // edge over implied (50%) probability
    evPerDollar: 0.18,
    evUsd: 2300,
  },
  {
    marketId: "ev2",
    marketName: "SOL plan: $165 → $220 target",
    entryPrice: 165,
    smartMoneyProb: 0.55,
    edgePct: 4.2,
    evPerDollar: 0.11,
    evUsd: 600,
  },
  {
    marketId: "ev3",
    marketName: "WIF plan: drift past target",
    entryPrice: 0.95,
    smartMoneyProb: 0.32,
    edgePct: -8.0,
    evPerDollar: -0.16,
    evUsd: -540,
  },
];

