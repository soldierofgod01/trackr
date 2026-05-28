"use client";
import { SideNav } from "@/components/layout/side-nav";
import { TickerBar } from "@/components/layout/ticker-bar";
import { PressureModule } from "@/components/pressure/pressure-module";
import { PortfolioModule } from "@/components/portfolio/portfolio-module";
import { ScannerModule } from "@/components/scanner/scanner-module";
import { WhaleFlowModule } from "@/components/whale-flow/whale-flow-module";
import { useAppStore } from "@/stores/app-store";

function AlertsPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-[480px] text-center">
        <div className="w-[58px] h-[58px] bg-[#111] border border-border rounded-[14px] flex items-center justify-center mb-[22px] mx-auto">
          <span className="text-[24px]">&#128276;</span>
        </div>
        <h2 className="text-[24px] font-semibold tracking-[-0.025em] mb-[10px]">
          Alerts &mdash; coming soon
        </h2>
        <p className="text-txt-muted text-[14px] leading-[1.55] mb-2">
          Price targets, liquidation warnings, plan drift. Delivered to Telegram in real-time.
        </p>
        <p className="text-txt-dim text-[12px]">v2 feature</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { activeModule } = useAppStore();

  // No splash / hub - app opens straight into the dashboard (v20).
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeModule === "pressure" && <PressureModule />}
          {activeModule === "whale-flow" && <WhaleFlowModule />}
          {activeModule === "portfolio" && <PortfolioModule />}
          {activeModule === "scanner" && <ScannerModule />}
          {activeModule === "alerts" && <AlertsPlaceholder />}
        </main>
      </div>
      <TickerBar />
    </div>
  );
}
