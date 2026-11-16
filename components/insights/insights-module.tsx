"use client";
import { useQuery } from "@tanstack/react-query";
import { TokenIcon } from "@/components/scanner/token-icon";
import type { Insight, DataPoint } from "@/lib/insights/insight-engine";

// ════════════════════════════════════════════════════════════════
// Insights — Mako's core. Every other tool shows data; this tells you
// what's happening and what it usually means. Interpretation, not calls.
// The trader decides.
// ════════════════════════════════════════════════════════════════

interface InsightsResponse {
  insights: Insight[];
  count: number;
  fetchedAt: string;
}

async function fetchInsights(): Promise<InsightsResponse> {
  const res = await fetch("/api/insights");
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

export function InsightsModule() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["insights"],
    queryFn: fetchInsights,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const insights = data?.insights ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-12 py-9 max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="mb-7">
          <h1 className="ds-page-title">What&rsquo;s worth watching</h1>
          <p className="mt-2 text-[14px] text-txt-secondary leading-[1.5] max-w-[620px]">
            Mako reads Hyperliquid&rsquo;s live positioning data and surfaces the setups forming right now —
            with the evidence and what each pattern usually means. You make the call.
          </p>
        </div>

        {isError ? (
          <div className="ds-panel ds-panel-signature py-16 text-center text-txt-muted text-[14px]">
            Couldn&rsquo;t reach Hyperliquid. Retrying…
          </div>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ds-panel h-[200px] animate-pulse" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="ds-panel ds-panel-signature py-16 text-center">
            <div className="text-[15px] font-semibold text-txt-primary mb-1.5">Quiet right now</div>
            <p className="text-[13px] text-txt-muted max-w-[420px] mx-auto leading-[1.5]">
              No strong setups across the liquid markets at the moment. Mako only surfaces reads when the
              positioning data actually shows something — no noise for the sake of it.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((ins) => (
              <InsightCard key={ins.symbol} insight={ins} />
            ))}
          </div>
        )}

        {/* Honest footer */}
        <p className="mt-6 text-[12px] text-txt-muted leading-[1.55] max-w-[680px]">
          These are interpretations of live positioning data, not trade recommendations. Patterns describe
          tendencies, not certainties — funding and open-interest reads can persist longer than expected.
          Always do your own analysis before acting.
        </p>

        <div className="h-10" />
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const dirColor =
    insight.direction === "bullish" ? "text-positive" :
    insight.direction === "bearish" ? "text-negative" : "text-txt-secondary";
  const dirLabel =
    insight.direction === "bullish" ? "Bullish read" :
    insight.direction === "bearish" ? "Bearish read" : "Neutral / caution";

  return (
    <div className="ds-panel ds-panel-signature p-5 flex flex-col gap-4">
      {/* Top row: token + direction */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <TokenIcon symbol={insight.symbol} size={32} />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-txt-primary">{insight.symbol}</div>
            <div className="text-[13px] font-medium text-txt-primary">{insight.setup}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[12px] font-semibold ${dirColor}`}>{dirLabel}</span>
          <StrengthDots strength={insight.strength} />
        </div>
      </div>

      {/* Data points */}
      <div className="flex flex-wrap gap-2">
        {insight.dataPoints.map((dp, i) => (
          <DataChip key={i} dp={dp} />
        ))}
      </div>

      {/* Meaning */}
      <p className="text-[13px] text-txt-secondary leading-[1.55]">{insight.meaning}</p>
    </div>
  );
}

function DataChip({ dp }: { dp: DataPoint }) {
  const tone =
    dp.tone === "pos" ? "text-positive" :
    dp.tone === "neg" ? "text-negative" : "text-txt-primary";
  return (
    <div className="px-2.5 py-1.5 rounded-[7px] bg-bg-base border border-border flex items-center gap-2">
      <span className="ds-label">{dp.label}</span>
      <span className={`ds-num text-[12.5px] font-medium ${tone}`}>{dp.value}</span>
    </div>
  );
}

function StrengthDots({ strength }: { strength: number }) {
  // 1-4 dots based on strength
  const filled = strength >= 75 ? 4 : strength >= 50 ? 3 : strength >= 25 ? 2 : 1;
  return (
    <div className="flex items-center gap-1" title={`Signal strength: ${Math.round(strength)}/100`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: i < filled ? "var(--color-accent)" : "rgba(255,255,255,0.12)" }}
        />
      ))}
    </div>
  );
}
