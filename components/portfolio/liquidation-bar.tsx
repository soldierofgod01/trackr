"use client";
import { MOCK_POSITIONS } from "@/lib/mock-data";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export function LiquidationBar() {
  // Only perp positions have liq prices
  const perps = MOCK_POSITIONS.filter((p) => p.venue === "perp" && p.liquidationPrice);

  if (perps.length === 0) return null;

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[13px] p-6 mb-[22px]">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="flex items-center gap-2 text-[13px] font-medium text-txt-secondary">
          <AlertTriangle className="w-[13px] h-[13px]" />
          Liquidation distance
          <span className="text-[11px] text-txt-dim">· perp positions only</span>
        </div>
        <div className="text-[11.5px] font-mono text-txt-muted">
          {perps.length} position{perps.length === 1 ? "" : "s"} · always know the line
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {perps.map((p) => {
          const liqPrice = p.liquidationPrice!;
          const cur = p.currentPrice;
          const entry = p.entryPrice;
          const isLong = p.side === "long";

          // Distance to liq as a percentage
          const distancePct = isLong
            ? ((cur - liqPrice) / cur) * 100
            : ((liqPrice - cur) / cur) * 100;

          const riskLevel: "safe" | "watch" | "danger" =
            distancePct < 8 ? "danger" : distancePct < 18 ? "watch" : "safe";

          // For the bar: show liq → entry → current → safe-zone
          // Range from liq price to 1.5x distance
          const range = isLong
            ? Math.max(cur * 1.2, entry * 1.1) - liqPrice
            : liqPrice - Math.min(cur * 0.8, entry * 0.9);
          const barMin = isLong ? liqPrice : Math.min(cur * 0.8, entry * 0.9);

          const liqPos = ((liqPrice - barMin) / range) * 100;
          const entryPos = ((entry - barMin) / range) * 100;
          const curPos = ((cur - barMin) / range) * 100;

          const riskColor =
            riskLevel === "danger" ? "text-negative" : riskLevel === "watch" ? "text-warning" : "text-positive";
          const riskBg =
            riskLevel === "danger" ? "bg-negative/10" : riskLevel === "watch" ? "bg-warning/10" : "bg-positive/10";
          const RiskIcon = riskLevel === "safe" ? ShieldCheck : AlertTriangle;

          return (
            <div key={p.id} className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{p.symbol}</span>
                  <span className={`font-mono text-[10px] font-semibold px-[6px] py-0.5 rounded ${
                    p.side === "long" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
                  }`}>
                    {p.side.toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-warning bg-warning/10 px-[5px] py-0.5 rounded">
                    {p.leverage}x
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 font-mono text-[11px] font-medium px-[8px] py-[2px] rounded ${riskColor} ${riskBg}`}>
                  <RiskIcon className="w-[11px] h-[11px]" />
                  {distancePct.toFixed(1)}% from liq
                </div>
              </div>

              {/* Distance bar */}
              <div className="relative h-[8px] bg-[#1C1C1C] rounded-full">
                {/* danger zone (close to liq) */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-negative/50 to-warning/30 rounded-full"
                  style={{ width: `${Math.min(curPos, 100)}%` }}
                />
                {/* liq marker */}
                <div
                  className="absolute -top-[2px] w-[3px] h-[12px] bg-negative rounded-sm"
                  style={{ left: `calc(${liqPos}% - 1.5px)` }}
                  title={`Liq: $${liqPrice.toLocaleString()}`}
                />
                {/* entry marker */}
                <div
                  className="absolute -top-[2px] w-[2px] h-[12px] bg-txt-secondary rounded-sm"
                  style={{ left: `calc(${entryPos}% - 1px)` }}
                  title={`Entry: $${entry.toLocaleString()}`}
                />
                {/* current marker */}
                <div
                  className="absolute -top-[3px] w-[3px] h-[14px] bg-white rounded-sm shadow-md"
                  style={{ left: `calc(${curPos}% - 1.5px)` }}
                  title={`Now: $${cur.toLocaleString()}`}
                />
              </div>

              {/* Labels under bar */}
              <div className="flex justify-between font-mono text-[10px] text-txt-muted">
                <span className="text-negative">Liq ${liqPrice.toLocaleString()}</span>
                <span className="text-txt-secondary">Entry ${entry.toLocaleString()}</span>
                <span className="text-white font-medium">Now ${cur.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
