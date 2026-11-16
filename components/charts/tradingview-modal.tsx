"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { TradingViewChart } from "./tradingview-chart";

interface Props {
  symbol: string;
  onClose: () => void;
}

export function TradingViewModal({ symbol, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";  // lock scroll
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1200px] h-[80vh] bg-[#0A0A0A] border border-border rounded-[14px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-[#0a0a0a] shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-[14px] font-semibold text-white">{symbol}</div>
            <span className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-txt-muted">
              · 1H · chart not loading? use the symbol search in the chart
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-txt-muted hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/[0.05]"
            title="Close (Esc)"
          >
            <X className="w-[16px] h-[16px]" />
          </button>
        </div>

        {/* Chart container */}
        <div className="flex-1 min-h-0">
          <TradingViewChart symbol={symbol} interval="60" />
        </div>
      </div>
    </div>
  );
}
