"use client";
import { useState, useMemo } from "react";
import { MOCK_POSITIONS } from "@/lib/mock-data";

// How sensitive each token is to a BTC move (rough beta).
// Memes amplify (1.8x), alts move with it (1.3x), perps amplify by leverage.
const BTC_BETA: Record<string, number> = {
  BTC: 1.0, ETH: 1.1, SOL: 1.3, BNB: 0.9, XRP: 0.7, ADA: 1.2, AVAX: 1.3,
  LINK: 1.1, DOGE: 1.4, WIF: 1.8, PEPE: 1.9, BONK: 1.9, SHIB: 1.7,
  ARB: 1.2, OP: 1.2, HYPE: 1.3, AAVE: 1.1, UNI: 1.1, FET: 1.3, RNDR: 1.3,
  // Default for unknown tokens
};

function simulateBtcMove(pctChange: number) {
  let totalPnl = 0;
  const positionImpacts: { symbol: string; pnl: number; pct: number }[] = [];

  for (const p of MOCK_POSITIONS) {
    // Strip -PERP suffix for beta lookup
    const baseSymbol = p.symbol.replace("-PERP", "");
    const beta = BTC_BETA[baseSymbol] ?? 1.2;

    // Effective leverage (spot = 1x, perp uses position leverage)
    const lev = p.venue === "perp" ? (p.leverage ?? 1) : 1;

    // Direction-adjusted move
    const directionalPct = p.side === "long" ? pctChange : -pctChange;
    const positionPctMove = directionalPct * beta * lev;
    const dollarChange = (positionPctMove / 100) * p.sizeUsd;

    totalPnl += dollarChange;
    positionImpacts.push({
      symbol: p.symbol,
      pnl: dollarChange,
      pct: positionPctMove,
    });
  }

  positionImpacts.sort((a, b) => a.pnl - b.pnl); // worst first
  return { totalPnl, positionImpacts };
}

export function StressSimCard() {
  const [btcMove, setBtcMove] = useState(-15);
  const { totalPnl, positionImpacts } = useMemo(() => simulateBtcMove(btcMove), [btcMove]);

  const worst = positionImpacts.slice(0, 3).filter(p => p.pnl < 0);
  const best = positionImpacts.slice(-3).reverse().filter(p => p.pnl > 0);

  const pnlColor = totalPnl >= 0 ? "#10B981" : "#EF4444";

  // Quick preset buttons
  const presets = [-30, -15, -8, 8, 15];

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[14px] p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11.5px] font-medium text-txt-muted uppercase tracking-[0.08em]">
          What if BTC moves...
        </div>
        <div className="text-[10px] font-mono text-txt-dim">drag the slider</div>
      </div>

      {/* Big input value */}
      <div className="text-center mb-1 mt-3">
        <div
          className="font-mono text-[56px] font-medium tracking-[-0.03em] leading-none inline-flex items-baseline"
          style={{ color: btcMove >= 0 ? "#10B981" : "#EF4444" }}
        >
          {btcMove >= 0 ? "+" : ""}{btcMove}
          <span className="text-[24px] ml-0.5 opacity-70">%</span>
        </div>
      </div>

      {/* Slider */}
      <div className="px-2 mb-3 mt-4">
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={btcMove}
          onChange={(e) => setBtcMove(parseInt(e.target.value))}
          className="w-full accent-white cursor-pointer"
          style={{
            // Custom track that goes red on left, white-ish in middle, green right
            background: `linear-gradient(to right, #EF4444 0%, #EF4444 40%, #71717A 50%, #10B981 60%, #10B981 100%)`,
            height: 4,
            borderRadius: 2,
          }}
        />
        <div className="flex justify-between text-[9.5px] font-mono text-txt-dim mt-1.5 px-0.5">
          <span>-50%</span>
          <span>-25%</span>
          <span>0</span>
          <span>+25%</span>
          <span>+50%</span>
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex gap-1.5 mb-5 justify-center">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setBtcMove(p)}
            className={`px-2.5 py-1 rounded-[6px] font-mono text-[10.5px] transition-colors ${
              btcMove === p
                ? "bg-white text-black"
                : "bg-[#161616] text-txt-secondary hover:text-white"
            }`}
          >
            {p > 0 ? "+" : ""}{p}%
          </button>
        ))}
      </div>

      {/* P&L Result */}
      <div className="bg-[#0a0a0a] border border-dashed border-border rounded-[10px] p-4 mb-4 text-center">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-txt-muted mb-1">
          Your portfolio would move
        </div>
        <div className="font-mono text-[32px] font-medium tracking-[-0.025em] leading-none" style={{ color: pnlColor }}>
          {totalPnl >= 0 ? "+" : ""}${Math.round(Math.abs(totalPnl)).toLocaleString()}
        </div>
      </div>

      {/* Worst hit positions */}
      {worst.length > 0 && (
        <div className="mb-3">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-txt-muted mb-2">
            Hardest hit
          </div>
          <div className="space-y-1.5">
            {worst.map((p) => (
              <ImpactRow key={p.symbol} {...p} />
            ))}
          </div>
        </div>
      )}

      {best.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-txt-muted mb-2">
            Biggest gainers
          </div>
          <div className="space-y-1.5">
            {best.map((p) => (
              <ImpactRow key={p.symbol} {...p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactRow({ symbol, pnl, pct }: { symbol: string; pnl: number; pct: number }) {
  const color = pnl >= 0 ? "text-positive" : "text-negative";
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="font-mono font-medium text-txt-secondary">{symbol}</span>
      <div className={`font-mono ${color} flex items-baseline gap-2`}>
        <span className="font-medium">{pnl >= 0 ? "+" : "-"}${Math.round(Math.abs(pnl)).toLocaleString()}</span>
        <span className="text-[10px] opacity-70">{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
