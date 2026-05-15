"use client";
import { MOCK_POSITIONS, MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";
import { AlertTriangle, ArrowRight } from "lucide-react";

// Find the single most pressing risk and recommend one concrete action.
function findTopRisk() {
  const positions = MOCK_POSITIONS;
  const totalExposure = positions.reduce((s, p) => s + p.sizeUsd, 0);

  // Priority 1: any position within 15% of liquidation
  for (const p of positions) {
    if (p.venue === "perp" && p.liquidationPrice) {
      const dist = p.side === "long"
        ? ((p.currentPrice - p.liquidationPrice) / p.currentPrice) * 100
        : ((p.liquidationPrice - p.currentPrice) / p.currentPrice) * 100;
      if (dist < 15) {
        const newLev = Math.max(2, Math.floor((p.leverage ?? 5) / 2));
        return {
          severity: "critical" as const,
          title: `${p.symbol} ${p.leverage}x ${p.side} — ${dist.toFixed(0)}% from liquidation`,
          desc: `If ${p.symbol} drops ${dist.toFixed(0)}% you lose this entire position. That's $${Math.round(p.sizeUsd).toLocaleString()} gone in one move.`,
          action: `Reduce leverage from ${p.leverage}x to ${newLev}x`,
          actionDetail: `Pushes liquidation to ~${(dist * 2).toFixed(0)}% away. Same upside, half the downside.`,
        };
      }
    }
  }

  // Priority 2: concentration > 35% in one position
  const biggest = [...positions].sort((a, b) => b.sizeUsd - a.sizeUsd)[0];
  const biggestPct = (biggest.sizeUsd / totalExposure) * 100;
  if (biggestPct > 35) {
    return {
      severity: "high" as const,
      title: `${biggest.symbol} is ${biggestPct.toFixed(0)}% of your portfolio`,
      desc: `One bad ${biggest.symbol} day takes down your whole account. Diversification isn't about returns — it's about not being forced to sell at the bottom.`,
      action: `Trim ${biggest.symbol} to ~25% of portfolio`,
      actionDetail: `Sell roughly $${Math.round((biggest.sizeUsd - totalExposure * 0.25)).toLocaleString()} worth, rotate to BTC or stables.`,
    };
  }

  // Priority 3: memecoin > 10%
  const memeExposure = positions
    .filter((p) => p.category === "Memecoin")
    .reduce((s, p) => s + p.sizeUsd, 0);
  const memePct = (memeExposure / totalExposure) * 100;
  if (memePct > 10) {
    return {
      severity: "medium" as const,
      title: `${memePct.toFixed(0)}% in memecoins`,
      desc: `Memecoins can move -50% in a day. Above 10% portfolio weight, they dominate your account's volatility.`,
      action: "Cap memecoin exposure at 10%",
      actionDetail: `Trim memes by $${Math.round(memeExposure - totalExposure * 0.10).toLocaleString()}.`,
    };
  }

  // Priority 4: total perp leverage > 50%
  const perpExposure = positions
    .filter((p) => p.venue === "perp")
    .reduce((sum, p) => sum + p.sizeUsd * (p.leverage ?? 1), 0);
  const perpPct = (perpExposure / MOCK_PORTFOLIO_SUMMARY.totalValue) * 100;
  if (perpPct > 50) {
    return {
      severity: "medium" as const,
      title: `${perpPct.toFixed(0)}% effective perp exposure`,
      desc: `Your perp positions multiplied by leverage exceed your account. A bad day takes a big bite.`,
      action: "Reduce overall leverage",
      actionDetail: "Either close some perps or lower leverage on existing ones.",
    };
  }

  return {
    severity: "safe" as const,
    title: "No urgent risk detected",
    desc: "Portfolio is well-balanced, leverage is contained, and liquidation distances look healthy.",
    action: "Stay disciplined",
    actionDetail: "Stick to your plans and don't add positions just because nothing's broken.",
  };
}

export function TopRiskCard() {
  const r = findTopRisk();

  const colors = {
    critical: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)", text: "#EF4444", tag: "Critical" },
    high:     { bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.30)", text: "#F97316", tag: "High" },
    medium:   { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)", text: "#F59E0B", tag: "Medium" },
    safe:     { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.30)", text: "#10B981", tag: "OK" },
  }[r.severity];

  return (
    <div
      className="rounded-[14px] p-6 flex flex-col"
      style={{
        background: `linear-gradient(135deg, ${colors.bg}, transparent 70%), #0A0A0A`,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-[14px] h-[14px]" style={{ color: colors.text }} />
          <div className="text-[11.5px] font-medium uppercase tracking-[0.08em]" style={{ color: colors.text }}>
            Biggest risk right now
          </div>
        </div>
        <span
          className="text-[10px] font-mono uppercase tracking-[0.08em] px-2 py-0.5 rounded"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {colors.tag}
        </span>
      </div>

      {/* The issue */}
      <div className="mb-5">
        <h3 className="text-[18px] font-semibold leading-[1.25] tracking-[-0.015em] mb-2">
          {r.title}
        </h3>
        <p className="text-[13px] text-txt-secondary leading-[1.5]">
          {r.desc}
        </p>
      </div>

      {/* The action */}
      <div className="mt-auto pt-4 border-t border-dashed border-border">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-txt-muted mb-2">
          What to do
        </div>
        <button
          className="w-full text-left flex items-start gap-3 p-3 rounded-[10px] bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all group"
        >
          <div className="flex-1">
            <div className="text-[13.5px] font-medium text-white tracking-[-0.005em] mb-1">
              {r.action}
            </div>
            <div className="text-[11.5px] text-txt-muted leading-[1.45]">
              {r.actionDetail}
            </div>
          </div>
          <ArrowRight className="w-[15px] h-[15px] text-txt-muted group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1" />
        </button>
      </div>
    </div>
  );
}
