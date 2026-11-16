"use client";
import { useAppStore } from "@/stores/app-store";
import { generatePnlSeries, MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";
import { useMemo } from "react";

const PERIODS = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export function ValueChart() {
  const { portfolioPeriod, setPortfolioPeriod } = useAppStore();
  const s = MOCK_PORTFOLIO_SUMMARY;

  // Generate deterministic series based on period (more points for longer periods)
  const daysMap: Record<string, number> = { "1D": 24, "1W": 7, "1M": 30, "3M": 90, "1Y": 365, "ALL": 180 };
  const days = daysMap[portfolioPeriod] || 30;

  const series = useMemo(() => generatePnlSeries(days), [days]);

  const values = series.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const linePath = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 100 - ((p.value - minV) / range) * 90 - 5;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${linePath} L 100,100 L 0,100 Z`;

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[13px] p-6 mb-[22px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-3">
          <div className="text-[13px] font-medium text-txt-secondary">
            Portfolio value · {portfolioPeriod}
          </div>
        </div>
        <div className="flex gap-[1px] bg-[#0A0A0A] border border-border rounded-[7px] p-[3px]">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPortfolioPeriod(p)}
              className={`px-[10px] py-[5px] text-[11px] font-medium font-mono rounded-[5px] tracking-wide transition-colors ${
                portfolioPeriod === p ? "bg-[#1C1C1C] text-txt-primary" : "text-txt-muted hover:text-txt-primary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="font-mono text-[24px] font-medium tracking-[-0.02em] text-txt-primary mb-[14px] flex items-baseline gap-3">
        ${s.totalValue.toLocaleString()}
        <span className="text-[12px] text-positive font-medium">
          +${s.totalPnl.toLocaleString()} · +{s.totalPnlPct}%
        </span>
      </div>

      <div className="h-[150px] relative">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#chartGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#10B981"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
