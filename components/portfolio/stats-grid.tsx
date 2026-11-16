"use client";
import { MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";

function formatUSD(n: number, showSign = false): string {
  const sign = n >= 0 && showSign ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  return `${sign}$${abs.toLocaleString()}`;
}

export function StatsHero() {
  const s = MOCK_PORTFOLIO_SUMMARY;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border border border-border rounded-[13px] overflow-hidden mb-[14px]">
      {/* Total value */}
      <div className="bg-black px-6 py-5 flex flex-col gap-2 hover:bg-[#0A0A0A] transition-colors">
        <div className="text-[10.5px] text-txt-muted font-medium uppercase tracking-[0.08em]">
          Total value
        </div>
        <div className="font-mono text-[28px] font-medium tracking-[-0.025em] leading-[1.05]">
          ${s.totalValue.toLocaleString()}
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-positive bg-positive/10 px-[7px] py-0.5 rounded-md w-fit">
          +${s.totalValueDelta.toLocaleString()} today
        </div>
      </div>

      {/* Total P&L with realized/unrealized split */}
      <div className="bg-black px-6 py-5 flex flex-col gap-2 hover:bg-[#0A0A0A] transition-colors">
        <div className="text-[10.5px] text-txt-muted font-medium uppercase tracking-[0.08em]">
          Total P&amp;L
        </div>
        <div className={`font-mono text-[28px] font-medium tracking-[-0.025em] leading-[1.05] ${s.totalPnl >= 0 ? "text-positive" : "text-negative"}`}>
          {s.totalPnl >= 0 ? "+" : ""}${s.totalPnl.toLocaleString()}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10.5px] text-txt-muted">
          <span>
            Realized <span className="text-txt-secondary">${s.realizedPnl.toLocaleString()}</span>
          </span>
          <span className="text-txt-dim">·</span>
          <span>
            Unrealized <span className="text-txt-secondary">${s.unrealizedPnl.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Win rate */}
      <div className="bg-black px-6 py-5 flex flex-col gap-2 hover:bg-[#0A0A0A] transition-colors">
        <div className="text-[10.5px] text-txt-muted font-medium uppercase tracking-[0.08em]">
          Win rate
        </div>
        <div className="font-mono text-[28px] font-medium tracking-[-0.025em] leading-[1.05]">
          {s.winRate}%
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-positive bg-positive/10 px-[7px] py-0.5 rounded-md w-fit">
          {s.winsCount} of {s.resolvedCount} resolved
        </div>
      </div>

      {/* ROI */}
      <div className="bg-black px-6 py-5 flex flex-col gap-2 hover:bg-[#0A0A0A] transition-colors">
        <div className="text-[10.5px] text-txt-muted font-medium uppercase tracking-[0.08em]">
          ROI
        </div>
        <div className="font-mono text-[28px] font-medium tracking-[-0.025em] leading-[1.05]">
          +{s.roi}%
        </div>
        <div className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-positive bg-positive/10 px-[7px] py-0.5 rounded-md w-fit">
          top {s.roiRankPctile}% of wallets
        </div>
      </div>
    </div>
  );
}

export function StatsSecondary() {
  const s = MOCK_PORTFOLIO_SUMMARY;

  const items = [
    { label: "Exposure", val: formatUSD(s.exposureUsd), sub: `across ${s.activePositions} positions` },
    { label: "Active", val: String(s.activePositions), sub: "markets held" },
    {
      label: "Best position",
      val: `+${formatUSD(s.bestPositionUsd)}`,
      sub: s.bestPositionName,
      highlight: true,
    },
    {
      label: "Skill score",
      val: String(s.skillScore),
      sub: `rank #${s.skillRank} / ${s.totalWallets}`,
    },
    { label: "Avg hold time", val: `${s.avgHoldDays}d`, sub: `median ${s.medianHoldDays}d` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px] bg-border border border-border rounded-[13px] overflow-hidden mb-7">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-black px-[18px] py-[14px] flex flex-col gap-1 hover:bg-[#0A0A0A] transition-colors"
        >
          <div className="text-[10px] text-txt-muted font-medium uppercase tracking-[0.08em]">
            {item.label}
          </div>
          <div
            className={`font-mono text-[15px] font-medium tracking-[-0.015em] leading-[1.2] ${
              item.highlight ? "text-positive" : ""
            }`}
          >
            {item.val}
          </div>
          <div className="text-[10.5px] text-txt-muted leading-[1.2]">{item.sub}</div>
        </div>
      ))}
    </div>
  );
}
