import { WalletTier } from "@/types";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + formatUSD(n);
}

export function tierColor(tier: WalletTier): string {
  const map: Record<WalletTier, string> = {
    diamond: "#60A5FA",
    platinum: "#C0C0C0",
    gold: "#FACC15",
    silver: "#94A3B8",
    bronze: "#D97706",
  };
  return map[tier];
}

export function tierEmoji(tier: WalletTier): string {
  const map: Record<WalletTier, string> = {
    diamond: "🔷",
    platinum: "⬜",
    gold: "🥇",
    silver: "🥈",
    bronze: "🥉",
  };
  return map[tier];
}
