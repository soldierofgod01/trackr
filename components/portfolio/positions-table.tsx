"use client";
import { MOCK_POSITIONS } from "@/lib/mock-data";

const CHAIN_ICON: Record<string, string> = {
  ethereum: "Ξ",
  solana: "◎",
  base: "B",
  arbitrum: "A",
  optimism: "O",
  hyperliquid: "H",
  binance: "BN",
  bybit: "BY",
};

export function PositionsTable() {
  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[13px] p-6">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="text-[13px] font-medium text-txt-secondary">
          Open positions{" "}
          <span className="text-[11px] text-txt-dim">· {MOCK_POSITIONS.length} active</span>
        </div>
        <button className="text-txt-muted text-[12px] hover:text-txt-primary transition-colors">
          View all →
        </button>
      </div>

      <div className="flex flex-col gap-[1px] bg-border border border-border rounded-[9px] overflow-hidden">
        {/* Header */}
        <div
          className="py-[9px] px-4 bg-[#111] grid gap-[14px] items-center text-[9.5px] text-txt-muted uppercase tracking-[0.08em] font-medium"
          style={{ gridTemplateColumns: "1.6fr 64px 80px 92px 92px 100px" }}
        >
          <span>Asset</span>
          <span>Type</span>
          <span>Entry</span>
          <span className="text-right">Mark</span>
          <span className="text-right">Size</span>
          <span className="text-right">P&amp;L</span>
        </div>

        {MOCK_POSITIONS.map((p) => {
          const isPerp = p.venue === "perp";
          const sideColor = p.side === "long" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative";
          const pnlColor = p.unrealizedPnlUsd >= 0 ? "text-positive" : "text-negative";

          return (
            <div
              key={p.id}
              className="py-[13px] px-4 bg-[#0A0A0A] grid gap-[14px] items-center hover:bg-[#111] transition-colors cursor-pointer"
              style={{ gridTemplateColumns: "1.6fr 64px 80px 92px 92px 100px" }}
            >
              {/* Asset (symbol + chain) */}
              <div className="min-w-0 flex items-center gap-[10px]">
                <div className="w-[28px] h-[28px] rounded-full bg-[#161616] border border-border flex items-center justify-center flex-shrink-0 text-[11px] font-mono font-bold">
                  {p.symbol.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-txt-primary font-medium truncate flex items-center gap-1.5">
                    {p.symbol}
                    {isPerp && p.leverage && (
                      <span className="font-mono text-[9.5px] text-warning bg-warning/10 px-[5px] py-[1px] rounded">
                        {p.leverage}x
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-txt-muted font-mono uppercase">
                    {CHAIN_ICON[p.chain] ?? p.chain}
                  </div>
                </div>
              </div>

              {/* Type / Side */}
              <div className={`font-mono text-[10px] font-semibold px-[7px] py-0.5 rounded w-fit tracking-[0.03em] ${sideColor}`}>
                {isPerp ? p.side.toUpperCase() : "SPOT"}
              </div>

              {/* Entry */}
              <div className="font-mono text-[11.5px] text-txt-secondary">
                ${formatPrice(p.entryPrice)}
              </div>

              {/* Mark price */}
              <div className="font-mono text-[11.5px] text-txt-primary text-right">
                ${formatPrice(p.currentPrice)}
              </div>

              {/* Size */}
              <div className="font-mono text-[11.5px] text-txt-secondary text-right">
                ${p.sizeUsd.toLocaleString()}
              </div>

              {/* P&L */}
              <div className={`font-mono text-[12px] font-medium text-right flex flex-col items-end gap-[1px] tracking-[-0.01em] ${pnlColor}`}>
                <span>
                  {p.unrealizedPnlUsd >= 0 ? "+" : "-"}${Math.abs(p.unrealizedPnlUsd).toLocaleString()}
                </span>
                <span className="text-[10px] opacity-70">
                  {p.unrealizedPnlPct >= 0 ? "+" : ""}
                  {p.unrealizedPnlPct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toExponential(2);
}
