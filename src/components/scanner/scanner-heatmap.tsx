"use client";

import { useMemo } from "react";
import type { ScannerToken } from "@/types";

// ═══════════════════════════════════════════════════════════════
// Scanner Heatmap Grid (the "2.5D" view).
//
// Each token is a tile. Tile size is based on market cap (sqrt-scaled).
// Tile color is 24h % change mapped through a red→neutral→green scale.
// On hover, tiles lift toward the viewer with a perspective transform.
//
// Why 2.5D not true 3D: a real 3D scene (Three.js, force layout, etc.)
// adds camera controls + picking complexity + GPU cost for 250 tiles
// without making the data faster to read. CSS perspective + tilt gives
// the "this looks different" feel cheaply and stays fast.
// ═══════════════════════════════════════════════════════════════

interface Props {
  tokens: ScannerToken[];
  onSelect: (symbol: string) => void;
}

// ─── Color helpers ───

// Map 24h % change to a hex color on a red→black→green diverging scale.
// Saturates at ±10%.
function pctToColor(pct: number): { bg: string; text: string; glow: string } {
  const clamped = Math.max(-10, Math.min(10, pct));
  const intensity = Math.abs(clamped) / 10;   // 0..1

  if (clamped > 0.1) {
    // Green-leaning. We mix from deep neutral to vivid green.
    const r = Math.round(15 + (10 - 15) * intensity);   // 15 → 10
    const g = Math.round(15 + (185 - 15) * intensity);  // 15 → 185
    const b = Math.round(15 + (90 - 15) * intensity);   // 15 → 90
    return {
      bg: `rgb(${r},${g},${b})`,
      text: intensity > 0.4 ? "#FFFFFF" : "#10B981",
      glow: `rgba(16, 185, 129, ${0.15 + intensity * 0.35})`,
    };
  }
  if (clamped < -0.1) {
    const r = Math.round(15 + (220 - 15) * intensity);  // 15 → 220
    const g = Math.round(15 + (50 - 15) * intensity);   // 15 → 50
    const b = Math.round(15 + (60 - 15) * intensity);   // 15 → 60
    return {
      bg: `rgb(${r},${g},${b})`,
      text: intensity > 0.4 ? "#FFFFFF" : "#EF4444",
      glow: `rgba(239, 68, 68, ${0.15 + intensity * 0.35})`,
    };
  }
  return { bg: "#0A0A0A", text: "#A1A1AA", glow: "rgba(255,255,255,0.05)" };
}

// ─── Size mapping ───

// Sqrt mapping so a $1T token isn't 1000x bigger than a $1B token.
// Returns a row-span and col-span pair from a fixed bucket set.
function sizeBucket(marketCap: number, maxMcap: number): { col: number; row: number } {
  const r = Math.sqrt(marketCap / maxMcap);  // 0..1
  // 5 buckets: tiny → huge
  if (r > 0.6) return { col: 4, row: 3 };
  if (r > 0.35) return { col: 3, row: 2 };
  if (r > 0.18) return { col: 2, row: 2 };
  if (r > 0.08) return { col: 2, row: 1 };
  return { col: 1, row: 1 };
}

// ─── Formatters ───

function fmtPct(n: number): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function fmtUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Main component ───

export function ScannerHeatmap({ tokens, onSelect }: Props) {
  const { sortedTokens, maxMcap } = useMemo(() => {
    const sorted = [...tokens]
      .filter((t) => t.marketCapUsd > 0)
      .sort((a, b) => b.marketCapUsd - a.marketCapUsd);
    return {
      sortedTokens: sorted,
      maxMcap: sorted[0]?.marketCapUsd ?? 1,
    };
  }, [tokens]);

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[13px] overflow-hidden">
      {/* Legend strip */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-txt-muted">
            Heatmap
          </span>
          <span className="text-[11px] text-txt-secondary">
            Size = market cap · Color = 24h change · Click any tile to open chart
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <span className="text-txt-dim">-10%</span>
          <div
            className="h-3 w-32 rounded-[2px]"
            style={{
              background:
                "linear-gradient(90deg, rgb(220,50,60), rgb(120,30,35), #0A0A0A, rgb(10,90,50), rgb(10,185,90))",
            }}
          />
          <span className="text-txt-dim">+10%</span>
        </div>
      </div>

      {/* Grid */}
      <div
        className="p-3 grid gap-1.5 perspective-grid"
        style={{
          gridTemplateColumns: "repeat(20, minmax(0, 1fr))",
          gridAutoRows: "44px",
          gridAutoFlow: "dense",
          perspective: "1200px",
        }}
      >
        {sortedTokens.map((t) => {
          const { col, row } = sizeBucket(t.marketCapUsd, maxMcap);
          const colors = pctToColor(t.priceChange24h);
          return (
            <HeatmapTile
              key={t.symbol}
              token={t}
              col={col}
              row={row}
              colors={colors}
              onClick={() => onSelect(t.symbol)}
            />
          );
        })}
      </div>

      {/* Bottom hint */}
      <div className="px-5 py-2.5 border-t border-border text-[10px] font-mono text-txt-dim">
        {sortedTokens.length} tokens shown · hover for detail · tiles glow brighter on hover
      </div>
    </div>
  );
}

// ─── Individual tile ───

function HeatmapTile({
  token,
  col,
  row,
  colors,
  onClick,
}: {
  token: ScannerToken;
  col: number;
  row: number;
  colors: { bg: string; text: string; glow: string };
  onClick: () => void;
}) {
  const isBig = col >= 3;
  const isMedium = col >= 2 && col < 3;

  return (
    <button
      onClick={onClick}
      title={`${token.symbol} · ${fmtPct(token.priceChange24h)} 24h · MC ${fmtUsd(token.marketCapUsd)}`}
      className="heatmap-tile relative rounded-[6px] border border-white/[0.04] flex flex-col items-start justify-between p-2 overflow-hidden cursor-pointer transition-all duration-200 ease-out hover:border-white/30"
      style={{
        gridColumn: `span ${col}`,
        gridRow: `span ${row}`,
        background: colors.bg,
        color: colors.text,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Top row: symbol + % */}
      <div className="w-full flex items-baseline justify-between gap-1.5">
        <span
          className={`font-semibold tracking-tight truncate ${
            isBig ? "text-[15px]" : isMedium ? "text-[12px]" : "text-[10.5px]"
          }`}
        >
          {token.symbol}
        </span>
        <span
          className={`font-mono shrink-0 ${
            isBig ? "text-[13px]" : isMedium ? "text-[10.5px]" : "text-[9.5px]"
          }`}
        >
          {fmtPct(token.priceChange24h)}
        </span>
      </div>

      {/* Bottom row: price + market cap (only on larger tiles) */}
      {(isBig || isMedium) && (
        <div className="w-full flex items-baseline justify-between gap-1.5 opacity-80">
          <span
            className={`font-mono truncate ${
              isBig ? "text-[10.5px]" : "text-[9px]"
            }`}
          >
            ${token.priceUsd >= 1 ? token.priceUsd.toFixed(2) : token.priceUsd.toFixed(4)}
          </span>
          {isBig && (
            <span className="text-[9.5px] font-mono opacity-70">
              {fmtUsd(token.marketCapUsd)}
            </span>
          )}
        </div>
      )}

      {/* Hover glow overlay */}
      <span
        className="heatmap-glow absolute inset-0 rounded-[6px] pointer-events-none opacity-0 transition-opacity duration-200"
        style={{
          boxShadow: `inset 0 0 24px ${colors.glow}, 0 0 16px ${colors.glow}`,
        }}
      />

      <style jsx>{`
        .heatmap-tile {
          transform: translateZ(0);
        }
        .heatmap-tile:hover {
          transform: translateZ(20px) scale(1.05);
          z-index: 5;
        }
        .heatmap-tile:hover .heatmap-glow {
          opacity: 1;
        }
      `}</style>
    </button>
  );
}
