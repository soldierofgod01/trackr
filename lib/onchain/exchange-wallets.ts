// ═══════════════════════════════════════════════════════════════
// Known exchange wallet addresses (Ethereum mainnet).
//
// These are PUBLICLY documented hot/cold wallets — labelled openly by
// Etherscan, Arkham, Nansen, and used across Dune dashboards. This is NOT
// a complete labelling (CryptoQuant runs nodes + proprietary clustering for
// that). It's an honest v1 covering the largest, best-known wallets.
//
// Flow interpretation:
//   Tokens flowing INTO these wallets  = potential sell pressure
//   Tokens flowing OUT of these wallets = accumulation / withdrawal
//   For stablecoins, the interpretation inverts (inflow = buying power arriving)
// ═══════════════════════════════════════════════════════════════

export interface ExchangeWallet {
  address: string;
  exchange: string;
  label: string;
}

// Lowercased addresses for easy comparison against Etherscan results.
export const EXCHANGE_WALLETS: ExchangeWallet[] = [
  // Binance
  { address: "0x28c6c06298d514db089934071355e5743bf21d60", exchange: "Binance", label: "Binance 14" },
  { address: "0x21a31ee1afc51d94c2efccaa2092ad1028285549", exchange: "Binance", label: "Binance 15" },
  { address: "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", exchange: "Binance", label: "Binance 16" },
  { address: "0x56eddb7aa87536c09ccc2793473599fd21a8b17f", exchange: "Binance", label: "Binance 17" },
  { address: "0x9696f59e4d72e237be84ffd425dcad154bf96976", exchange: "Binance", label: "Binance 18" },
  { address: "0x4976a4a02f38326660d17bf34b431dc6e2eb2327", exchange: "Binance", label: "Binance 20" },
  // Coinbase
  { address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3", exchange: "Coinbase", label: "Coinbase 1" },
  { address: "0x503828976d22510aad0201ac7ec88293211d23da", exchange: "Coinbase", label: "Coinbase 2" },
  { address: "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740", exchange: "Coinbase", label: "Coinbase 3" },
  { address: "0x3cd751e6b0078be393132286c442345e5dc49699", exchange: "Coinbase", label: "Coinbase 4" },
  { address: "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511", exchange: "Coinbase", label: "Coinbase 5" },
  { address: "0xeb2629a2734e272bcc07bda959863f316f4bd4cf", exchange: "Coinbase", label: "Coinbase 6" },
  // OKX
  { address: "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", exchange: "OKX", label: "OKX 1" },
  { address: "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3", exchange: "OKX", label: "OKX 2" },
  // Kraken
  { address: "0x2910543af39aba0cd09dbb2d50200b3e800a63d2", exchange: "Kraken", label: "Kraken 1" },
  { address: "0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13", exchange: "Kraken", label: "Kraken 2" },
  { address: "0xe853c56864a2ebe4576a807d26fdc4a0ada51919", exchange: "Kraken", label: "Kraken 3" },
  // Bitfinex
  { address: "0x876eabf441b2ee5b5b0554fd502a8e0600950cfa", exchange: "Bitfinex", label: "Bitfinex 1" },
  { address: "0x77134cbc06cb00b66f4c7e623d5fdbf6777635ec", exchange: "Bitfinex", label: "Bitfinex 2" },
];

export const EXCHANGE_ADDRESS_SET = new Set(
  EXCHANGE_WALLETS.map((w) => w.address.toLowerCase()),
);

// Tokens we track flows for. Etherscan contract addresses on mainnet.
export interface TrackedToken {
  symbol: string;
  name: string;
  contract: string;   // ERC-20 contract address; "" for native ETH
  decimals: number;
  isStablecoin: boolean;
}

export const TRACKED_TOKENS: TrackedToken[] = [
  { symbol: "WETH", name: "Wrapped Ether", contract: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", decimals: 18, isStablecoin: false },
  { symbol: "USDT", name: "Tether",         contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6,  isStablecoin: true },
  { symbol: "USDC", name: "USD Coin",       contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6,  isStablecoin: true },
  { symbol: "WBTC", name: "Wrapped Bitcoin", contract: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", decimals: 8, isStablecoin: false },
  { symbol: "LINK", name: "Chainlink",      contract: "0x514910771af9ca656af840dff83e8264ecf986ca", decimals: 18, isStablecoin: false },
  { symbol: "UNI",  name: "Uniswap",        contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", decimals: 18, isStablecoin: false },
  { symbol: "PEPE", name: "Pepe",           contract: "0x6982508145454ce325ddbe47a25d4ec3d2311933", decimals: 18, isStablecoin: false },
  { symbol: "SHIB", name: "Shiba Inu",      contract: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", decimals: 18, isStablecoin: false },
];

export interface TokenFlow {
  symbol: string;
  name: string;
  isStablecoin: boolean;
  inflowUsd: number;      // into exchanges
  outflowUsd: number;     // out of exchanges
  netflowUsd: number;     // inflow - outflow (positive = net into exchanges)
  txCount: number;
  signal: string;         // plain-English read
  signalTone: "bearish" | "bullish" | "neutral";
}
