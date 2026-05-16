"use client";
import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";
import { Wallet, Info } from "lucide-react";

export function PortfolioEmpty() {
  const [addr, setAddr] = useState("");
  const { setWalletAddress } = useAppStore();

  // Accept EVM (0x...) and Solana (base58) addresses
  const trimmed = addr.trim();
  const isEvm = trimmed.startsWith("0x") && trimmed.length >= 40;
  const isSolana = !trimmed.startsWith("0x") && trimmed.length >= 32 && trimmed.length <= 44;
  const isValid = isEvm || isSolana;

  const connect = () => {
    if (isValid) setWalletAddress(trimmed);
  };

  const useDemo = () => setWalletAddress(MOCK_PORTFOLIO_SUMMARY.walletAddress);

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-[520px] w-full flex flex-col items-center text-center">
        <div className="w-[58px] h-[58px] bg-[#111] border border-border rounded-[14px] flex items-center justify-center mb-[22px]">
          <Wallet className="w-[26px] h-[26px] text-txt-secondary" strokeWidth={1.8} />
        </div>

        <h2 className="text-[24px] font-semibold tracking-[-0.025em] mb-[10px]">
          Connect your wallet
        </h2>
        <p className="text-txt-muted text-[14px] leading-[1.55] mb-7 max-w-[420px]">
          Paste your wallet address to see your positions across Ethereum, Solana,
          Hyperliquid, and major exchanges. Read-only — your keys never leave
          your wallet.
        </p>

        <div className="w-full max-w-[480px] flex flex-col gap-[10px]">
          <div className="flex items-center justify-between text-[11.5px] text-txt-muted font-medium">
            <span>EVM (0x...) or Solana address</span>
            <span className="font-mono text-[10px] text-txt-dim">multi-chain</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="0x... or solana address"
              className="flex-1 bg-[#0A0A0A] border border-border px-[14px] py-3 rounded-[9px] text-txt-primary font-mono text-[13px] outline-none focus:border-border-strong focus:bg-[#111] transition-colors"
            />
            <button
              onClick={connect}
              disabled={!isValid}
              className="px-5 py-3 bg-white text-black rounded-[9px] font-semibold text-[13px] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </div>
          <div className="mt-4 flex items-center gap-1.5 justify-center text-[11.5px] text-txt-dim">
            <Info className="w-3 h-3" />
            We detect chain automatically · positions sync across EVM + Solana + perps
          </div>
        </div>

        <div className="mt-7 pt-7 border-t border-dashed border-border w-full">
          <button
            onClick={useDemo}
            className="text-txt-secondary text-[12px] underline decoration-txt-dim underline-offset-[3px] hover:text-txt-primary transition-colors"
          >
            View demo with sample data →
          </button>
        </div>
      </div>
    </div>
  );
}
