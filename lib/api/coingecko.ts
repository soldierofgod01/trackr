// ═══════════════════════════════════════════════════════════════
// CoinGecko free API — token markets data
// Free tier: 30 calls/min, no key required (demo endpoint)
// ═══════════════════════════════════════════════════════════════

import type { ScannerToken, Chain } from "@/types";

// CoinGecko's /coins/markets endpoint returns this shape
interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  sparkline_in_7d?: { price: number[] };
}

// Heuristic mapping symbol → chain (rough, but good enough for v1 display)
const SYMBOL_TO_CHAIN: Record<string, Chain> = {
  btc: "binance", eth: "ethereum", sol: "solana", bnb: "binance",
  xrp: "ethereum", ada: "ethereum", doge: "ethereum", avax: "ethereum",
  link: "ethereum", ton: "ethereum", sui: "solana", hype: "hyperliquid",
  wif: "solana", pepe: "ethereum", bonk: "solana", arb: "arbitrum",
  op: "optimism", aave: "ethereum", uni: "ethereum", fet: "ethereum",
  rndr: "ethereum", render: "ethereum", trx: "ethereum", dot: "ethereum",
  matic: "ethereum", ltc: "binance", shib: "ethereum", near: "ethereum",
  ftm: "ethereum", inj: "ethereum", apt: "ethereum", icp: "ethereum",
  fil: "ethereum", atom: "ethereum", etc: "ethereum", xlm: "ethereum",
  cro: "ethereum", algo: "ethereum", vet: "ethereum", hbar: "ethereum",
};

// Categorize by symbol — rough but useful
const SYMBOL_TO_CATEGORY: Record<string, string> = {
  btc: "Major", eth: "Major", xrp: "Major", bnb: "Major",
  sol: "Alt L1", ada: "Alt L1", avax: "Alt L1", ton: "Alt L1",
  dot: "Alt L1", near: "Alt L1", apt: "Alt L1", sui: "Alt L1",
  trx: "Alt L1", icp: "Alt L1", atom: "Alt L1", algo: "Alt L1",
  hbar: "Alt L1", arb: "Alt L1", op: "Alt L1", matic: "Alt L1",
  ftm: "Alt L1", inj: "Alt L1",
  doge: "Memecoin", wif: "Memecoin", pepe: "Memecoin", shib: "Memecoin",
  bonk: "Memecoin", floki: "Memecoin",
  aave: "DeFi", uni: "DeFi", link: "DeFi", hype: "DeFi",
  cake: "DeFi", crv: "DeFi", mkr: "DeFi", ldo: "DeFi", snx: "DeFi",
  fet: "AI", rndr: "AI", render: "AI", agix: "AI", tao: "AI", ocean: "AI",
  fil: "Infrastructure", arweave: "Infrastructure", grt: "Infrastructure",
};

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchTopTokens(limit: number = 50): Promise<ScannerToken[]> {
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Cache for 30s on Vercel edge so we don't hammer CoinGecko on every page load
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);
  }

  const data: CGMarket[] = await res.json();

  return data.map((m) => {
    const sym = m.symbol.toLowerCase();
    const chain = SYMBOL_TO_CHAIN[sym] ?? "ethereum";
    const category = SYMBOL_TO_CATEGORY[sym] ?? "Alt L1";

    // Downsample sparkline from 168 hourly points → 24 points for clean rendering
    const rawSparkline = m.sparkline_in_7d?.price ?? [];
    const sparkline = downsample(rawSparkline, 24);

    return {
      symbol: m.symbol.toUpperCase(),
      name: m.name,
      chain,
      iconUrl: m.image,
      priceUsd: m.current_price ?? 0,
      priceChange24h: m.price_change_percentage_24h ?? 0,
      priceChange7d: m.price_change_percentage_7d_in_currency ?? 0,
      marketCapUsd: m.market_cap ?? 0,
      volume24h: m.total_volume ?? 0,
      category,
      // These will get filled in by hyperliquid merge step (perp data)
      openInterestUsd: 0,
      openInterestChange24h: 0,
      fundingRate8h: 0,
      sparkline7d: sparkline,
    };
  });
}

function downsample(arr: number[], targetPoints: number): number[] {
  if (arr.length === 0) return [];
  if (arr.length <= targetPoints) {
    // Normalize to 0-1 range for sparkline rendering
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    return arr.map((v) => (v - min) / range);
  }

  const step = arr.length / targetPoints;
  const result: number[] = [];
  for (let i = 0; i < targetPoints; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  const min = Math.min(...result);
  const max = Math.max(...result);
  const range = max - min || 1;
  return result.map((v) => (v - min) / range);
}
