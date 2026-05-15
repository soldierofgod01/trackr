"use client";
import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { RiskScoreCard } from "./risk-score-card";
import { TopRiskCard } from "./top-risk-card";
import { StressSimCard } from "./stress-sim-card";
import { PositionSizerCard } from "./position-sizer-card";

export function RiskModule() {
  const { walletAddress, setWalletAddress, setActiveModule } = useAppStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Risk module needs a wallet to analyze
  if (!walletAddress) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-[460px] text-center">
          <div className="w-[58px] h-[58px] bg-[#111] border border-border rounded-[14px] flex items-center justify-center mb-[22px] mx-auto">
            <AlertTriangle className="w-[26px] h-[26px] text-risk" strokeWidth={1.8} />
          </div>
          <h2 className="text-[24px] font-semibold tracking-[-0.025em] mb-[10px]">
            Connect a wallet to analyze risk
          </h2>
          <p className="text-txt-muted text-[14px] leading-[1.55] mb-6">
            Risk gives you a single score, your biggest risk in plain English,
            and a calculator that tells you exactly how much to bet.
          </p>
          <button
            onClick={() => setActiveModule("portfolio")}
            className="px-5 py-2.5 bg-white text-black rounded-[9px] font-semibold text-[13px] hover:opacity-90 transition-opacity"
          >
            Go to Portfolio →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 md:px-10 py-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none">Risk</h1>
            <div className="mt-[10px] flex items-center gap-[10px] text-[12.5px] text-txt-muted">
              <span>How risky is your portfolio? What should you do about it?</span>
              <span>·</span>
              <button
                onClick={() => setWalletAddress(null)}
                className="font-mono text-[11px] text-txt-primary bg-[#0A0A0A] px-[9px] py-1 rounded-md border border-border hover:border-border-strong transition-colors flex items-center gap-1.5"
              >
                {walletAddress.length > 12 ? walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4) : walletAddress}
                <ChevronRight className="w-[10px] h-[10px] text-txt-muted" />
              </button>
            </div>
          </div>
        </div>

        {/* 4-card grid — the entire risk story at a glance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <RiskScoreCard />
          <TopRiskCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <StressSimCard />
          <PositionSizerCard />
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border border-border rounded-[10px] hover:border-border-strong transition-colors group"
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`w-[14px] h-[14px] text-txt-muted transition-transform ${showAdvanced ? "rotate-0" : "-rotate-90"}`}
            />
            <span className="text-[12.5px] font-medium text-txt-secondary group-hover:text-white transition-colors">
              Advanced view
            </span>
            <span className="text-[10.5px] font-mono text-txt-dim">correlations, EV, hedges</span>
          </div>
          <span className="text-[10.5px] font-mono text-txt-dim">
            {showAdvanced ? "hide" : "show"}
          </span>
        </button>

        {showAdvanced && (
          <div className="mt-4 p-6 bg-[#0A0A0A] border border-dashed border-border rounded-[12px]">
            <div className="text-center py-12">
              <div className="text-[14px] text-txt-secondary mb-2">Advanced metrics coming soon</div>
              <div className="text-[11.5px] text-txt-muted">
                Correlation matrix, expected value tables, and pairwise hedge suggestions
                will go here. For now, the 4 cards above cover what you actually need.
              </div>
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
