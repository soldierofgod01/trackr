"use client";

interface Props {
  prices: number[];
  positive: boolean;
  width?: number;
  height?: number;
}

// Tiny inline sparkline for the Scanner row column.
// Just a thin line — no fill, no gradient, no axes. Designed for ~100×24px.
export function InlineSparkline({ prices, positive, width = 100, height = 24 }: Props) {
  if (!prices || prices.length < 2) {
    return <div style={{ width, height }} className="text-txt-dim text-[10px] ds-num flex items-center">—</div>;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = width / (prices.length - 1);

  const path = prices
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const color = positive ? "#10B981" : "#EF4444";

  return (
    <svg width={width} height={height} className="block">
      <path d={path} fill="none" stroke={color} strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
