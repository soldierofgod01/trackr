"use client";

interface Props {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
}

export function Sparkline({ data, positive = true, width = 80, height = 26 }: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const color = positive ? "#10B981" : "#EF4444";
  const linePath = "M " + pts.join(" L ");
  const areaPath = linePath + ` L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spark-${positive ? "p" : "n"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${positive ? "p" : "n"})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
