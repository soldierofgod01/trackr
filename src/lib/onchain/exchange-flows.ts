// ═══════════════════════════════════════════════════════════════
// Exchange flow computation.
//
// For each tracked token, pulls recent ERC-20 transfers via Etherscan's
// `tokentx` endpoint, classifies each as inflow (to an exchange wallet) or
// outflow (from one), and nets them. Needs ETHERSCAN_API_KEY in env.
//
// Without a key, returns realistic MOCK data so the UI is fully functional
// for design review. Mock rows are clearly flagged via the `isMock` field
// on the response.
// ═══════════════════════════════════════════════════════════════

import {
  TRACKED_TOKENS,
  EXCHANGE_ADDRESS_SET,
  type TokenFlow,
} from "./exchange-wallets";

const ETHERSCAN_API = "https://api.etherscan.io/api";

// Rough USD prices for converting token amounts. In production these would
// come from the existing price feed; for flow magnitude they need only be
// approximate. Updated opportunistically.
const APPROX_PRICE: Record<string, number> = {
  WETH: 2600, USDT: 1, USDC: 1, WBTC: 68000,
  LINK: 14, UNI: 8, PEPE: 0.0000095, SHIB: 0.0000095,
};

function buildSignal(netflowUsd: number, isStablecoin: boolean): { signal: string; tone: "bearish" | "bullish" | "neutral" } {
  const absM = Math.abs(netflowUsd) / 1e6;
  const magnitude = absM >= 50 ? "Heavy" : absM >= 10 ? "Elevated" : absM >= 1 ? "Moderate" : "Light";

  // For normal tokens: net INTO exchanges = sell pressure (bearish)
  // For stablecoins: net INTO exchanges = buying power arriving (bullish)
  if (Math.abs(netflowUsd) < 250_000) {
    return { signal: "Balanced flow — no clear pressure", tone: "neutral" };
  }

  const intoExchanges = netflowUsd > 0;

  if (isStablecoin) {
    return intoExchanges
      ? { signal: `${magnitude} stablecoin inflow — buying power arriving`, tone: "bullish" }
      : { signal: `${magnitude} stablecoin outflow — dry powder leaving`, tone: "bearish" };
  }
  return intoExchanges
    ? { signal: `${magnitude} inflow — elevated sell-side pressure`, tone: "bearish" }
    : { signal: `${magnitude} outflow — accumulation / withdrawal`, tone: "bullish" };
}

// ─── Mock data (no API key) ───
function mockFlows(): TokenFlow[] {
  const seed = [
    { symbol: "WETH", net: -42_000_000, txc: 1840 },
    { symbol: "USDT", net: 88_000_000, txc: 5210 },
    { symbol: "USDC", net: 31_000_000, txc: 3120 },
    { symbol: "WBTC", net: -12_500_000, txc: 410 },
    { symbol: "LINK", net: 4_200_000, txc: 690 },
    { symbol: "UNI", net: -800_000, txc: 220 },
    { symbol: "PEPE", net: 6_900_000, txc: 1130 },
    { symbol: "SHIB", net: -150_000, txc: 540 },
  ];
  return seed.map((s) => {
    const tok = TRACKED_TOKENS.find((t) => t.symbol === s.symbol)!;
    const inflow = s.net > 0 ? s.net + s.net * 0.4 : Math.abs(s.net) * 0.3;
    const outflow = inflow - s.net;
    const { signal, tone } = buildSignal(s.net, tok.isStablecoin);
    return {
      symbol: s.symbol,
      name: tok.name,
      isStablecoin: tok.isStablecoin,
      inflowUsd: inflow,
      outflowUsd: outflow,
      netflowUsd: s.net,
      txCount: s.txc,
      signal,
      signalTone: tone,
    };
  });
}

interface EtherscanTx {
  from: string;
  to: string;
  value: string;
  tokenDecimal: string;
  timeStamp: string;
}

async function fetchTokenFlow(
  contract: string,
  decimals: number,
  symbol: string,
  apiKey: string,
  sinceTs: number,
): Promise<{ inflowUsd: number; outflowUsd: number; txCount: number }> {
  // tokentx: most recent transfers for this contract, newest first
  const url = `${ETHERSCAN_API}?module=account&action=tokentx&contractaddress=${contract}&page=1&offset=1000&sort=desc&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return { inflowUsd: 0, outflowUsd: 0, txCount: 0 };
  const data = await res.json();
  if (data.status !== "1" || !Array.isArray(data.result)) {
    return { inflowUsd: 0, outflowUsd: 0, txCount: 0 };
  }

  const price = APPROX_PRICE[symbol] ?? 0;
  let inflowUsd = 0, outflowUsd = 0, txCount = 0;

  for (const tx of data.result as EtherscanTx[]) {
    if (parseInt(tx.timeStamp) * 1000 < sinceTs) break; // sorted desc; stop at window edge
    const amount = parseFloat(tx.value) / Math.pow(10, decimals);
    const usd = amount * price;
    const toExch = EXCHANGE_ADDRESS_SET.has(tx.to.toLowerCase());
    const fromExch = EXCHANGE_ADDRESS_SET.has(tx.from.toLowerCase());
    if (toExch && !fromExch) { inflowUsd += usd; txCount++; }
    else if (fromExch && !toExch) { outflowUsd += usd; txCount++; }
  }
  return { inflowUsd, outflowUsd, txCount };
}

export interface FlowsResponse {
  flows: TokenFlow[];
  isMock: boolean;
  fetchedAt: string;
}

export async function fetchExchangeFlows(): Promise<FlowsResponse> {
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    return { flows: mockFlows(), isMock: true, fetchedAt: new Date().toISOString() };
  }

  const since = Date.now() - 24 * 60 * 60 * 1000;

  try {
    const flows: TokenFlow[] = [];
    // Sequential to respect Etherscan's 5 req/sec free-tier limit
    for (const tok of TRACKED_TOKENS) {
      if (!tok.contract) continue;
      const { inflowUsd, outflowUsd, txCount } = await fetchTokenFlow(
        tok.contract, tok.decimals, tok.symbol, apiKey, since,
      );
      const netflowUsd = inflowUsd - outflowUsd;
      const { signal, tone } = buildSignal(netflowUsd, tok.isStablecoin);
      flows.push({
        symbol: tok.symbol,
        name: tok.name,
        isStablecoin: tok.isStablecoin,
        inflowUsd, outflowUsd, netflowUsd, txCount,
        signal, signalTone: tone,
      });
      await new Promise((r) => setTimeout(r, 220)); // throttle
    }
    return { flows, isMock: false, fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error("Exchange flows error:", err);
    return { flows: mockFlows(), isMock: true, fetchedAt: new Date().toISOString() };
  }
}
