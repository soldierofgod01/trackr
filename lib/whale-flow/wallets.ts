// ═══════════════════════════════════════════════════════════════
// Whale wallets being tracked.
//
// IMPORTANT: This is a HAND-CURATED list. The Hyperliquid public API doesn't
// expose a leaderboard endpoint that we can hit for free auto-detection.
// To auto-detect, we'd need either:
//   - Scraping app.hyperliquid.xyz/leaderboard (fragile)
//   - A paid data provider (Nansen, Apify, etc.)
//
// For now, addresses are sourced from the public HL leaderboard manually.
// To rotate this list: edit the array, redeploy. Eventually moves to Supabase
// so we can update without a deploy.
// ═══════════════════════════════════════════════════════════════

export interface WhaleWallet {
  address: string;       // EVM address, lowercase
  alias: string;         // human-friendly label
  category: "hl_trader" | "smart_money" | "vault";
  notes?: string;        // optional context
}

// Public HL traders + known smart money. These are placeholder addresses —
// in production we'd verify against current top-of-leaderboard.
// Format: lowercase 0x... address (HL APIs accept either case but we
// normalize for consistency).
export const WHALE_WALLETS: WhaleWallet[] = [
  // Top HL traders (placeholders pending live verification)
  { address: "0xf3f496c9486be5924a93d67e98298733bb47057c", alias: "HL Trader #1", category: "hl_trader" },
  { address: "0x97abf24c4cce0c8c11f9c7da33d31a4fbf014e9d", alias: "HL Trader #2", category: "hl_trader" },
  { address: "0x010461c14e146ac35fe42271bdc1134ee31c703a", alias: "HL Trader #3", category: "hl_trader" },
  { address: "0x8cc94dc843e1ea7a19805e0cca43001123512b6a", alias: "HL Trader #4", category: "hl_trader" },
  { address: "0xff4b76f670c1d5e6c0a834b3eea0d68b34c1f9cc", alias: "HL Trader #5", category: "hl_trader" },
];
