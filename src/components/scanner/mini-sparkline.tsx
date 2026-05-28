"use client";

import type { SparklinePoint } from "@/lib/api/hl-candles";

interface Props {
  points: SparklinePoint[];
  positive: boolean;
  width?: number;
  height?: number;
}

export function MiniSparkline({ points, positive, width = 320, height = 60 }: Props) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-txt-muted text-[11px]"
        style={{ width, height }}
      >
        No data
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.price - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  const color = positive ? "#10B981" : "#EF4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-fill-${positive ? "up" : "dn"}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#spark-fill-${positive ? "up" : "dn"})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
