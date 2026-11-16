"use client";
import { useAppStore } from "@/stores/app-store";
import { PortfolioEmpty } from "./portfolio-empty";
import { StatsHero, StatsSecondary } from "./stats-grid";
import { ValueChart } from "./value-chart";
import { LiquidationBar } from "./liquidation-bar";
import { PositionsTable } from "./positions-table";
import { ExposureCard } from "./exposure-card";
import { CalibrationCard } from "./calibration-card";
import { InsightsRow } from "./insights-row";
import { ChevronRight } from "lucide-react";

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function PortfolioModule() {
  const { walletAddress, setWalletAddress } = useAppStore();

  if (!walletAddress) {
    return <PortfolioEmpty />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 md:px-10 py-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] leading-none">
              Your portfolio
            </h1>
            <div className="mt-[10px] flex items-center gap-[10px] text-[12.5px] text-txt-muted">
              <span>Updated moments ago</span>
              <span>·</span>
              <button
                onClick={() => setWalletAddress(null)}
                className="font-mono text-[11px] text-txt-primary bg-[#0A0A0A] px-[9px] py-1 rounded-md border border-border hover:border-border-strong transition-colors flex items-center gap-1.5"
              >
                {shortenAddress(walletAddress)}
                <ChevronRight className="w-[10px] h-[10px] text-txt-muted" />
              </button>
            </div>
          </div>
        </div>

        <StatsHero />
        <StatsSecondary />
        <ValueChart />
        <LiquidationBar />

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[14px]">
          <PositionsTable />
          <ExposureCard />
        </div>

        <CalibrationCard />
        <InsightsRow />

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
