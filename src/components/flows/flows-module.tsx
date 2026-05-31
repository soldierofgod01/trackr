"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TokenIcon } from "@/components/scanner/token-icon";
import type { TokenFlow } from "@/lib/onchain/exchange-wallets";
import type { FlowsResponse } from "@/lib/onchain/exchange-flows";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// Exchange Flows — CryptoQuant-inspired on-chain module.
// Net token flow to/from known exchange wallets. Inflow = sell pressure
// (for stablecoins, inflow = buying power). Honest v1: tracks the major
// publicly-documented exchange wallets, not a complete labelling.
// ════════════════════════════════════════════════════════════════

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

async function fetchFlows(): Promise<FlowsResponse> {
  const res = await fetch("/api/flows");
  if (!res.ok) throw new Error("Failed to fetch flows");
  return res.json();
}

export function FlowsModule() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["exchange-flows"],
    queryFn: fetchFlows,
    refetchInterval: 300_000, // 5 min
    refetchOnWindowFocus: false,
  });

  const flows = useMemo(() => data?.flows ?? [], [data]);
  const isMock = data?.isMock ?? false;

  // Sort by absolute netflow magnitude — biggest signals first
  const sorted = useMemo(
    () => [...flows].sort((a, b) => Math.abs(b.netflowUsd) - Math.abs(a.netflowUsd)),
    [flows],
  );

  const totalNet = flows.reduce((s, f) => s + f.netflowUsd, 0);
  const biggestInflow = useMemo(
    () => flows.filter((f) => !f.isStablecoin).sort((a, b) => b.netflowUsd - a.netflowUsd)[0],
    [flows],
  );
  const biggestOutflow = useMemo(
    () => flows.filter((f) => !f.isStablecoin).sort((a, b) => a.netflowUsd - b.netflowUsd)[0],
    [flows],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="px-8 md:px-12 py-9 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="ds-page-title">Exchange Flows</h1>
          <p className="mt-2 text-[14px] text-txt-secondary leading-[1.5]">
            Capital moving on/off exchanges. Inflows signal sell-side pressure; outflows signal accumulation.
          </p>
        </div>

        {/* Mock-data banner */}
        {isMock && !isLoading && (
          <div className="mb-5 px-4 py-3 rounded-[9px] border border-warning/30 bg-warning/[0.06] flex items-start gap-2.5">
            <span className="text-warning text-[13px] font-semibold shrink-0">Sample data</span>
            <span className="text-[13px] text-txt-secondary leading-[1.5]">
              Showing example flows. Add your free Etherscan API key (<span className="ds-num">ETHERSCAN_API_KEY</span>) in Vercel to see live on-chain data.
            </span>
          </div>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-7">
          <div className="ds-panel px-4 py-3.5">
            <div className="ds-label mb-1.5">Net flow (all tracked)</div>
            <div className={`ds-num text-[20px] font-semibold leading-none ${totalNet > 0 ? "text-negative" : "text-positive"}`}>
              {fmtUsd(totalNet)}
            </div>
            <div className="ds-num text-[11px] text-txt-muted mt-1.5">
              {totalNet > 0 ? "Net into exchanges" : "Net out of exchanges"}
            </div>
          </div>
          <div className="ds-panel px-4 py-3.5">
            <div className="ds-label mb-1.5">Most accumulated</div>
            <div className="ds-num text-[20px] font-semibold text-positive leading-none">
              {biggestOutflow ? biggestOutflow.symbol : "—"}
            </div>
            <div className="ds-num text-[11px] text-txt-muted mt-1.5">
              {biggestOutflow ? `${fmtUsd(biggestOutflow.netflowUsd)} net` : "—"}
            </div>
          </div>
          <div className="ds-panel px-4 py-3.5">
            <div className="ds-label mb-1.5">Most distributed</div>
            <div className="ds-num text-[20px] font-semibold text-negative leading-none">
              {biggestInflow ? biggestInflow.symbol : "—"}
            </div>
            <div className="ds-num text-[11px] text-txt-muted mt-1.5">
              {biggestInflow ? `${fmtUsd(biggestInflow.netflowUsd)} net` : "—"}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="ds-panel overflow-hidden">
          <div
            className="grid gap-4 px-5 h-11 items-center border-b border-border"
            style={{ gridTemplateColumns: "minmax(150px,1.2fr) 120px 120px 130px 100px minmax(220px,1.4fr)" }}
          >
            <span className="ds-label">Token</span>
            <span className="ds-label text-right">Inflow 24h</span>
            <span className="ds-label text-right">Outflow 24h</span>
            <span className="ds-label text-right">Net flow</span>
            <span className="ds-label text-right">Txns</span>
            <span className="ds-label">Signal</span>
          </div>

          {isError ? (
            <div className="py-20 text-center text-txt-muted text-[14px]">Couldn&rsquo;t load flows. Retrying…</div>
          ) : isLoading ? (
            <div className="py-20 text-center text-txt-muted text-[14px]">Loading exchange flows…</div>
          ) : (
            sorted.map((f) => <FlowRow key={f.symbol} flow={f} />)
          )}
        </div>

        {/* Methodology note */}
        <p className="mt-4 text-[12px] text-txt-muted leading-[1.55] max-w-[760px]">
          Flows are computed from ERC-20 transfers to and from major publicly-documented exchange wallets
          (Binance, Coinbase, OKX, Kraken, Bitfinex). This is a representative sample of exchange activity,
          not a complete labelling of every exchange address.
        </p>

        <div className="h-10" />
      </div>
    </div>
  );
}

function FlowRow({ flow: f }: { flow: TokenFlow }) {
  const toneColor =
    f.signalTone === "bearish" ? "text-negative" :
    f.signalTone === "bullish" ? "text-positive" : "text-txt-muted";
  const netColor = f.netflowUsd > 0 ? "text-negative" : f.netflowUsd < 0 ? "text-positive" : "text-txt-muted";

  return (
    <div
      className="grid gap-4 px-5 h-[56px] items-center border-b border-border last:border-0 hover:bg-elevated transition-colors"
      style={{ gridTemplateColumns: "minmax(150px,1.2fr) 120px 120px 130px 100px minmax(220px,1.4fr)" }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <TokenIcon symbol={f.symbol} size={28} />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-txt-primary truncate">{f.symbol}</div>
          <div className="text-[11px] text-txt-muted truncate">{f.isStablecoin ? "Stablecoin" : f.name}</div>
        </div>
      </div>

      <div className="text-right ds-num text-[13px] text-txt-secondary flex items-center justify-end gap-1">
        <ArrowDownToLine className="w-3 h-3 text-negative/70" />
        {fmtUsd(f.inflowUsd)}
      </div>

      <div className="text-right ds-num text-[13px] text-txt-secondary flex items-center justify-end gap-1">
        <ArrowUpFromLine className="w-3 h-3 text-positive/70" />
        {fmtUsd(f.outflowUsd)}
      </div>

      <div className={`text-right ds-num text-[13.5px] font-semibold ${netColor}`}>
        {f.netflowUsd > 0 ? "+" : ""}{fmtUsd(f.netflowUsd)}
      </div>

      <div className="text-right ds-num text-[13px] text-txt-muted">{f.txCount.toLocaleString()}</div>

      <div className={`text-[12.5px] ${toneColor} leading-[1.4]`}>{f.signal}</div>
    </div>
  );
}
