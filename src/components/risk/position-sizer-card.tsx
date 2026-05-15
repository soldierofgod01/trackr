"use client";
import { useState, useMemo } from "react";
import { MOCK_PORTFOLIO_SUMMARY } from "@/lib/mock-data";
import { Calculator } from "lucide-react";

export function PositionSizerCard() {
  const accountSize = MOCK_PORTFOLIO_SUMMARY.totalValue;

  const [entry, setEntry] = useState<string>("90000");
  const [stop, setStop] = useState<string>("82800");
  const [riskPct, setRiskPct] = useState<number>(1);
  const [side, setSide] = useState<"long" | "short">("long");

  const result = useMemo(() => {
    const e = parseFloat(entry);
    const s = parseFloat(stop);
    if (!e || !s || e <= 0 || s <= 0) return null;

    // Validate stop direction
    const validStop = side === "long" ? s < e : s > e;
    if (!validStop) return { error: side === "long" ? "Stop should be below entry for a long" : "Stop should be above entry for a short" };

    const riskPerCoin = Math.abs(e - s);
    const riskPct_decimal = riskPct / 100;
    const dollarRisk = accountSize * riskPct_decimal;
    const positionSize = dollarRisk / riskPerCoin;       // in tokens
    const positionUsd = positionSize * e;
    const stopDistancePct = (riskPerCoin / e) * 100;
    const portfolioPctUsed = (positionUsd / accountSize) * 100;

    return {
      dollarRisk,
      positionSize,
      positionUsd,
      stopDistancePct,
      portfolioPctUsed,
    };
  }, [entry, stop, riskPct, side, accountSize]);

  const riskOptions = [0.5, 1, 2, 3];

  return (
    <div className="bg-[#0A0A0A] border border-border rounded-[14px] p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calculator className="w-[14px] h-[14px] text-txt-muted" />
          <div className="text-[11.5px] font-medium text-txt-muted uppercase tracking-[0.08em]">
            Position sizer
          </div>
        </div>
        <div className="text-[10px] font-mono text-txt-dim">
          account: ${(accountSize / 1000).toFixed(1)}k
        </div>
      </div>

      {/* Side toggle */}
      <div className="flex gap-1 mb-4 bg-[#0a0a0a] p-1 rounded-[8px] border border-border">
        {(["long", "short"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-[6px] transition-colors ${
              side === s
                ? s === "long"
                  ? "bg-positive/15 text-positive"
                  : "bg-negative/15 text-negative"
                : "text-txt-muted hover:text-txt-secondary"
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="space-y-3 mb-4">
        <NumberInput label="Entry price" value={entry} onChange={setEntry} placeholder="90,000" />
        <NumberInput label={side === "long" ? "Stop loss (below entry)" : "Stop loss (above entry)"} value={stop} onChange={setStop} placeholder="82,800" />
      </div>

      {/* Risk % slider */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2 text-[11.5px] text-txt-muted">
          <span>Risk per trade</span>
          <span className="font-mono text-white font-medium">{riskPct}% of account</span>
        </div>
        <div className="flex gap-1.5">
          {riskOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setRiskPct(opt)}
              className={`flex-1 py-2 rounded-[7px] font-mono text-[12px] transition-colors ${
                riskPct === opt
                  ? "bg-white text-black font-medium"
                  : "bg-[#161616] text-txt-secondary hover:text-white"
              }`}
            >
              {opt}%
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && "error" in result ? (
        <div className="p-3 rounded-[8px] bg-negative/10 border border-negative/30 text-[12px] text-negative">
          {result.error}
        </div>
      ) : result ? (
        <div className="bg-gradient-to-b from-white/[0.03] to-transparent rounded-[10px] p-4 border border-dashed border-border space-y-3">
          {/* Main answer */}
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-txt-muted mb-1">
              Buy this much
            </div>
            <div className="font-mono text-[26px] font-medium tracking-[-0.02em] text-white leading-none">
              ${Math.round(result.positionUsd).toLocaleString()}
            </div>
            <div className="text-[11.5px] text-txt-muted mt-1.5">
              ≈ {result.positionSize.toFixed(result.positionSize > 10 ? 1 : 4)} units · {result.portfolioPctUsed.toFixed(1)}% of account
            </div>
          </div>

          {/* Risk explanation in plain English */}
          <div className="pt-3 border-t border-dashed border-border text-[11.5px] text-txt-secondary leading-[1.55]">
            If your stop hits ({result.stopDistancePct.toFixed(1)}% away),
            {" "}you lose <span className="text-negative font-mono font-medium">${Math.round(result.dollarRisk).toLocaleString()}</span>
            {" "}— exactly {riskPct}% of your account.
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-[8px] bg-[#0a0a0a] border border-border text-[12px] text-txt-muted text-center">
          Enter entry and stop prices
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11.5px] text-txt-muted mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim font-mono text-[13px]">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={placeholder}
          className="w-full bg-[#0a0a0a] border border-border focus:border-white/20 rounded-[8px] pl-7 pr-3 py-2.5 font-mono text-[13.5px] text-white outline-none transition-colors"
        />
      </div>
    </div>
  );
}
