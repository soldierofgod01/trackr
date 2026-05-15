"use client";
import { MOCK_POSITIONS, MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";

// Compute a 0-100 risk score from portfolio characteristics.
// Higher = riskier. Designed so a typical retail trader has intuition:
//   0-30:  Safe       (well-diversified, low leverage, no liq risk)
//   31-60: Moderate   (some concentration or leverage)
//   61-85: High       (heavy concentration, multiple perps, tight liq)
//   86-100: Critical  (immediate action needed)

function computeRiskScore() {
  const positions = MOCK_POSITIONS;
  const account = MOCK_PORTFOLIO_SUMMARY.totalValue;

  // 1. Leverage exposure (0-30 points)
  const perpExposure = positions
    .filter((p) => p.venue === "perp")
    .reduce((sum, p) => sum + p.sizeUsd * (p.leverage ?? 1), 0);
  const leverageScore = Math.min(30, (perpExposure / account) * 30);

  // 2. Liquidation proximity (0-25 points)
  const closestLiq = positions
    .filter((p) => p.venue === "perp" && p.liquidationPrice)
    .map((p) => {
      const dist = p.side === "long"
        ? ((p.currentPrice - p.liquidationPrice!) / p.currentPrice) * 100
        : ((p.liquidationPrice! - p.currentPrice) / p.currentPrice) * 100;
      return dist;
    });
  const minDist = closestLiq.length > 0 ? Math.min(...closestLiq) : 100;
  const liqScore = Math.max(0, Math.min(25, ((25 - minDist) / 25) * 25));

  // 3. Concentration (0-25 points) — largest position as % of portfolio
  const totalExposure = positions.reduce((s, p) => s + p.sizeUsd, 0);
  const biggestPos = Math.max(...positions.map((p) => p.sizeUsd));
  const concentrationPct = (biggestPos / totalExposure) * 100;
  const concentrationScore = Math.min(25, Math.max(0, (concentrationPct - 20) / 2));

  // 4. Volatility category mix (0-20 points)
  const memecoinPct = positions
    .filter((p) => p.category === "Memecoin")
    .reduce((s, p) => s + p.sizeUsd, 0) / totalExposure * 100;
  const volScore = Math.min(20, memecoinPct);

  const total = Math.round(leverageScore + liqScore + concentrationScore + volScore);
  return {
    total,
    breakdown: {
      leverage: Math.round(leverageScore),
      liquidation: Math.round(liqScore),
      concentration: Math.round(concentrationScore),
      volatility: Math.round(volScore),
    },
    minLiqDistance: minDist,
    biggestPosPct: concentrationPct,
    perpExposurePct: (perpExposure / account) * 100,
  };
}

export function RiskScoreCard() {
  const r = computeRiskScore();

  const level =
    r.total <= 30 ? "Safe" : r.total <= 60 ? "Moderate" : r.total <= 85 ? "High" : "Critical";

  const color =
    r.total <= 30 ? "#10B981" :
    r.total <= 60 ? "#F59E0B" :
    r.total <= 85 ? "#F97316" : "#EF4444";

  const arc = (r.total / 100) * 270;  // 270deg sweep
  const radius = 88;
  const cx = 100, cy = 110;

  // Convert polar to cartesian for SVG arc
  const startAngle = 135;  // bottom-left
  const endAngle = startAngle + arc;
  const polarToCartesian = (angle: number) => ({
    x: cx + radius * Math.cos((angle * Math.PI) / 180),
    y: cy + radius * Math.sin((angle * Math.PI) / 180),
  });
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = arc > 180 ? 1 : 0;
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  // Background full track (270deg)
  const trackEnd = polarToCartesian(startAngle + 270);
  const trackPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[14px] p-6 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11.5px] font-medium text-txt-muted uppercase tracking-[0.08em]">
          Risk Score
        </div>
        <div className="font-mono text-[10px] text-txt-dim">live</div>
      </div>

      {/* Gauge */}
      <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: 200 }}>
        <svg viewBox="0 0 200 200" className="w-full max-w-[220px]" style={{ overflow: "visible" }}>
          {/* Background track */}
          <path
            d={trackPath}
            fill="none"
            stroke="#1C1C1C"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 12px ${color}55)` }}
          />
          {/* Center number */}
          <text
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fontSize="56"
            fontWeight="600"
            fill="#fff"
            fontFamily="JetBrains Mono"
            style={{ letterSpacing: "-0.03em" }}
          >
            {r.total}
          </text>
          <text
            x={cx}
            y={cy + 32}
            textAnchor="middle"
            fontSize="11"
            fill="#71717A"
            fontFamily="JetBrains Mono"
            letterSpacing="0.1em"
          >
            / 100
          </text>
        </svg>
      </div>

      {/* Level label */}
      <div className="text-center -mt-3 mb-4">
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-medium"
          style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {level}
        </span>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <BreakdownRow label="Leverage" value={r.breakdown.leverage} max={30} />
        <BreakdownRow label="Liq risk" value={r.breakdown.liquidation} max={25} />
        <BreakdownRow label="Concentration" value={r.breakdown.concentration} max={25} />
        <BreakdownRow label="Volatility mix" value={r.breakdown.volatility} max={20} />
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  const color = pct > 70 ? "#EF4444" : pct > 40 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10.5px] text-txt-muted">
        <span>{label}</span>
        <span className="font-mono text-txt-secondary">{value}/{max}</span>
      </div>
      <div className="h-[3px] bg-[#1C1C1C] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
