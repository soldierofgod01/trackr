"use client";
import { MOCK_EXPOSURE } from "@/lib/mock-data";

export function ExposureCard() {
  const exposure = MOCK_EXPOSURE;

  // Build donut arcs
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let angle = -90;

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[13px] p-6">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="text-[13px] font-medium text-txt-secondary">Category exposure</div>
      </div>

      <div className="flex justify-center mb-[18px] mt-1">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={radius} fill="none" stroke="#161616" strokeWidth="14" />
          {exposure.map((e, i) => {
            const arcLen = (e.pct / 100) * circumference;
            const startA = angle;
            angle += (e.pct / 100) * 360;
            return (
              <circle
                key={e.category}
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke={e.color}
                strokeWidth="14"
                strokeDasharray={`${arcLen} ${circumference}`}
                transform={`rotate(${startA} 65 65)`}
              />
            );
          })}
          <text
            x="65"
            y="63"
            textAnchor="middle"
            fill="#fff"
            fontFamily="JetBrains Mono"
            fontSize="20"
            fontWeight="500"
            dominantBaseline="middle"
          >
            {exposure.length}
          </text>
          <text
            x="65"
            y="82"
            textAnchor="middle"
            fill="#71717A"
            fontSize="9"
            letterSpacing="1"
            fontWeight="500"
          >
            CATEGORIES
          </text>
        </svg>
      </div>

      <div className="flex flex-col gap-[9px]">
        {exposure.map((e) => (
          <div key={e.category}>
            <div className="flex items-center gap-[10px]">
              <div
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: e.color }}
              />
              <div className="flex-1 text-[12px] text-txt-secondary">{e.category}</div>
              <div className="font-mono text-[11.5px] text-txt-primary font-medium">
                {e.pct}%
              </div>
            </div>
            <div className="ml-[18px] mt-0.5 h-[3px] bg-[#161616] rounded-[2px] overflow-hidden">
              <div
                className="h-full rounded-[2px]"
                style={{ width: `${e.pct}%`, background: e.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
