"use client";
import { useState } from "react";
import { MOCK_CALIBRATION, MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";
import { Info } from "lucide-react";

const CALIBRATION_SCORE = 87;

// Plot constants (viewBox 240x240)
const PAD = { l: 30, r: 10, t: 10, b: 30 };
const W = 240;
const H = 240;
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

function xScale(pct: number) {
  return PAD.l + (pct / 100) * plotW;
}
function yScale(winPct: number) {
  return H - PAD.b - (winPct / 100) * plotH;
}

export function CalibrationCard() {
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);

  const scoreLabel =
    CALIBRATION_SCORE >= 85
      ? "Well-calibrated"
      : CALIBRATION_SCORE >= 70
      ? "Decent estimates"
      : CALIBRATION_SCORE >= 55
      ? "Somewhat miscalibrated"
      : "Refine your estimates";

  const scoreColor =
    CALIBRATION_SCORE >= 85
      ? "positive"
      : CALIBRATION_SCORE >= 70
      ? "positive"
      : "warning";

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[13px] p-6 md:p-7 mt-[22px]">
      <div className="grid md:grid-cols-[1fr_1.1fr] gap-8 items-center">
        {/* Left: score + insight */}
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-txt-secondary flex items-center gap-2">
              Calibration
              <span className="relative group">
                <Info className="w-[13px] h-[13px] text-txt-muted cursor-help" />
                <span className="invisible group-hover:visible absolute left-full top-0 ml-2 w-[260px] p-[10px_14px] bg-black border border-border-strong rounded-lg text-[11px] text-txt-secondary leading-[1.5] z-20">
                  How well your entry prices predict actual outcomes. If you
                  buy YES at $0.40, you're estimating 40% probability. A score
                  of 100 means your estimates perfectly match reality.
                </span>
              </span>
            </div>
            <span className="font-mono text-[10.5px] text-txt-dim">
              {MOCK_PORTFOLIO_SUMMARY.resolvedCount} settled trades
            </span>
          </div>

          <div className="flex items-baseline gap-[10px] mt-1">
            <span className="font-mono text-[52px] font-medium tracking-[-0.03em] leading-none text-txt-primary">
              {CALIBRATION_SCORE}
            </span>
            <span className="font-mono text-[18px] text-txt-muted">/ 100</span>
          </div>

          <span
            className={`inline-flex items-center gap-[6px] px-[10px] py-1 rounded-[6px] border text-[11px] font-medium w-fit ${
              scoreColor === "positive"
                ? "bg-positive/8 border-positive/20 text-positive"
                : "bg-warning/8 border-warning/20 text-warning"
            }`}
          >
            <span
              className="w-[6px] h-[6px] rounded-full"
              style={{
                background: scoreColor === "positive" ? "#10B981" : "#F59E0B",
              }}
            />
            {scoreLabel}
          </span>

          <div className="bg-[#111] border border-border border-l-[2px] border-l-positive rounded-lg px-[14px] py-3 mt-1.5">
            <div className="text-[12px] font-medium mb-1">
              Size up in the 40–60% range
            </div>
            <div className="text-[11.5px] text-txt-muted leading-[1.5]">
              You bought at implied{" "}
              <span className="text-txt-primary font-mono font-medium">~50%</span>, but
              actually win{" "}
              <span className="text-txt-primary font-mono font-medium">68%</span> of
              the time in this bucket. Your edge is strongest on coin-flip
              markets — bet larger here.
            </div>
          </div>

          <button className="text-txt-secondary text-[12px] hover:text-txt-primary transition-colors w-fit text-left mt-1">
            Full calibration analysis in Risk →
          </button>
        </div>

        {/* Right: reliability chart */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <div className="text-[11px] text-txt-muted font-medium uppercase tracking-[0.08em]">
              Reliability diagram
            </div>
            <span className="font-mono text-[10.5px] text-txt-dim">
              estimated vs actual
            </span>
          </div>

          <div className="relative mx-auto w-full max-w-[240px] aspect-square">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
              {/* Grid lines */}
              {[25, 50, 75].map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.l}
                    y1={yScale(v)}
                    x2={W - PAD.r}
                    y2={yScale(v)}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="2 3"
                  />
                  <line
                    x1={xScale(v)}
                    y1={PAD.t}
                    x2={xScale(v)}
                    y2={H - PAD.b}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="2 3"
                  />
                </g>
              ))}
              {/* Axes */}
              <line
                x1={PAD.l}
                y1={H - PAD.b}
                x2={W - PAD.r}
                y2={H - PAD.b}
                stroke="#52525B"
              />
              <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#52525B" />

              {/* Perfect calibration diagonal */}
              <line
                x1={xScale(0)}
                y1={yScale(0)}
                x2={xScale(100)}
                y2={yScale(100)}
                stroke="#52525B"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                fill="none"
              />

              {/* Axis labels */}
              <text
                x={xScale(0)}
                y={H - PAD.b + 14}
                textAnchor="middle"
                className="fill-txt-dim font-mono text-[9px]"
              >
                0%
              </text>
              <text
                x={xScale(50)}
                y={H - PAD.b + 14}
                textAnchor="middle"
                className="fill-txt-dim font-mono text-[9px]"
              >
                50%
              </text>
              <text
                x={xScale(100)}
                y={H - PAD.b + 14}
                textAnchor="middle"
                className="fill-txt-dim font-mono text-[9px]"
              >
                100%
              </text>
              <text
                x={PAD.l - 8}
                y={yScale(0) + 3}
                textAnchor="end"
                className="fill-txt-dim font-mono text-[9px]"
              >
                0
              </text>
              <text
                x={PAD.l - 8}
                y={yScale(50) + 3}
                textAnchor="end"
                className="fill-txt-dim font-mono text-[9px]"
              >
                50
              </text>
              <text
                x={PAD.l - 8}
                y={yScale(100) + 3}
                textAnchor="end"
                className="fill-txt-dim font-mono text-[9px]"
              >
                100
              </text>

              {/* Data points */}
              {MOCK_CALIBRATION.map((b, i) => {
                const cx = xScale(b.midpoint);
                const cy = yScale(b.actualWinRate);
                const haloR = 8 + Math.sqrt(b.sampleCount) * 2;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredBucket(i)}
                    onMouseLeave={() => setHoveredBucket(null)}
                    className="cursor-pointer"
                  >
                    <circle cx={cx} cy={cy} r={haloR} fill="#3B82F6" opacity="0.2" />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={hoveredBucket === i ? 7 : 5}
                      fill="#3B82F6"
                    />
                  </g>
                );
              })}

              {/* Axis titles */}
              <text
                x={PAD.l + plotW / 2}
                y={H - 5}
                textAnchor="middle"
                className="fill-txt-muted text-[10px]"
              >
                Your entry price (implied %)
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex justify-between font-mono text-[9.5px] text-txt-dim -mt-1.5">
            <div className="flex items-center gap-[5px]">
              <span
                className="w-3 h-[1.5px] inline-block"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, #52525B 0, #52525B 2px, transparent 2px, transparent 4px)",
                }}
              />
              Perfect calibration
            </div>
            <div className="flex items-center gap-[5px]">
              <span className="w-[7px] h-[7px] rounded-full bg-radar inline-block" />
              Your buckets · size = sample
            </div>
          </div>

          {/* Bucket table */}
          <div className="grid grid-cols-5 gap-[4px] mt-1">
            {MOCK_CALIBRATION.map((b, i) => {
              const diff = b.actualWinRate - b.midpoint;
              const aboveColor =
                diff > 5 ? "text-positive" : diff < -5 ? "text-negative" : "text-txt-primary";
              return (
                <div
                  key={i}
                  className="px-1.5 py-2 bg-[#111] border border-border rounded-md text-center transition-all hover:border-border-strong hover:bg-[#161616] cursor-pointer"
                  title={`${b.range[0]}–${b.range[1]}% entries: won ${b.actualWinRate}% of ${b.sampleCount} trades`}
                >
                  <div className="font-mono text-[9px] text-txt-dim mb-0.5">
                    {b.range[0]}–{b.range[1]}%
                  </div>
                  <div
                    className={`font-mono text-[13px] font-medium tracking-[-0.01em] ${aboveColor}`}
                  >
                    {b.actualWinRate}%
                  </div>
                  <div className="font-mono text-[8.5px] text-txt-dim mt-0.5">
                    n={b.sampleCount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
