"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// TradingView's free Advanced Chart widget
// Docs: https://www.tradingview.com/widget/advanced-chart/
// No API key required. Loads tv.js once globally.

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: TradingViewConfig) => unknown;
    };
  }
}

interface TradingViewConfig {
  autosize: boolean;
  symbol: string;
  interval: string;
  timezone: string;
  theme: "light" | "dark";
  style: string;
  locale: string;
  enable_publishing: boolean;
  withdateranges: boolean;
  hide_side_toolbar: boolean;
  allow_symbol_change: boolean;
  container_id: string;
  studies?: string[];
  overrides?: Record<string, string | number | boolean>;
  studies_overrides?: Record<string, string | number | boolean>;
  toolbar_bg?: string;
  loading_screen?: { backgroundColor?: string; foregroundColor?: string };
}

// Map our symbol to a TradingView symbol.
// Most liquid tokens are on Binance. Some (HL-native like HYPE, newer alts)
// aren't — for those we fall back to other exchanges. TradingView resolves
// the first valid one. allow_symbol_change stays ON so users can correct it.
const NON_BINANCE: Record<string, string> = {
  HYPE: "BYBIT:HYPEUSDT",
  // add more as they surface
};

function toTVSymbol(symbol: string): string {
  const base = symbol.replace("-PERP", "").toUpperCase();
  if (NON_BINANCE[base]) return NON_BINANCE[base];
  return `BINANCE:${base}USDT`;
}

let scriptLoadPromise: Promise<void> | null = null;
function loadTVScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.TradingView) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load TradingView"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

interface Props {
  symbol: string;
  onClose: () => void;
}

export function TradingViewModal({ symbol, onClose }: Props) {
  const containerId = useRef(`tv-chart-${Math.random().toString(36).slice(2)}`);

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

  // Load and initialize the chart
  useEffect(() => {
    let cancelled = false;

    loadTVScript().then(() => {
      if (cancelled || !window.TradingView) return;

      // Slight delay to make sure the container div is in the DOM
      setTimeout(() => {
        if (cancelled || !window.TradingView) return;

        new window.TradingView.widget({
          autosize: true,
          symbol: toTVSymbol(symbol),
          interval: "60",       // 1H default
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",           // candles
          locale: "en",
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: containerId.current,
          // NO explicit Volume study here — the Advanced Chart widget already
          // renders a volume sub-pane built into the candle series. Adding
          // "Volume@tv-basicstudies" on top produced TWO volume panes (v18 fix).
          toolbar_bg: "#0A0A0A",
          loading_screen: { backgroundColor: "#0A0A0A", foregroundColor: "#FFFFFF" },
          // ── Black & white theme: white-up / grey-down candles, grey volume,
          // black background, subtle grid. Matches the Trackr terminal aesthetic.
          overrides: {
            // Chart background and grid
            "paneProperties.background": "#0A0A0A",
            "paneProperties.backgroundType": "solid",
            "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.04)",
            "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.04)",
            "paneProperties.crossHairProperties.color": "rgba(255,255,255,0.35)",
            "scalesProperties.textColor": "#A1A1AA",
            "scalesProperties.lineColor": "rgba(255,255,255,0.08)",
            // Candle colors: white = up, grey = down, no green/red
            "mainSeriesProperties.candleStyle.upColor": "#FFFFFF",
            "mainSeriesProperties.candleStyle.downColor": "#52525B",
            "mainSeriesProperties.candleStyle.borderUpColor": "#FFFFFF",
            "mainSeriesProperties.candleStyle.borderDownColor": "#52525B",
            "mainSeriesProperties.candleStyle.wickUpColor": "#FFFFFF",
            "mainSeriesProperties.candleStyle.wickDownColor": "#71717A",
            "mainSeriesProperties.candleStyle.drawBorder": true,
            "mainSeriesProperties.candleStyle.drawWick": true,
            // Hollow candles fallback
            "mainSeriesProperties.hollowCandleStyle.upColor": "#FFFFFF",
            "mainSeriesProperties.hollowCandleStyle.downColor": "#52525B",
            "mainSeriesProperties.hollowCandleStyle.borderUpColor": "#FFFFFF",
            "mainSeriesProperties.hollowCandleStyle.borderDownColor": "#52525B",
            "mainSeriesProperties.hollowCandleStyle.wickUpColor": "#FFFFFF",
            "mainSeriesProperties.hollowCandleStyle.wickDownColor": "#71717A",
            // Bar / line styles (in case user switches)
            "mainSeriesProperties.barStyle.upColor": "#FFFFFF",
            "mainSeriesProperties.barStyle.downColor": "#52525B",
            "mainSeriesProperties.lineStyle.color": "#FFFFFF",
            "mainSeriesProperties.areaStyle.color1": "rgba(255,255,255,0.18)",
            "mainSeriesProperties.areaStyle.color2": "rgba(255,255,255,0)",
            "mainSeriesProperties.areaStyle.linecolor": "#FFFFFF",
            // Status / legend text
            "mainSeriesProperties.statusViewStyle.symbolTextSource": "ticker",
          },
          studies_overrides: {
            // Volume: muted greys, no red/green
            "volume.volume.color.0": "#52525B",   // down volume
            "volume.volume.color.1": "#A1A1AA",   // up volume
            "volume.volume.transparency": 35,
            "volume.volume ma.color": "#FFFFFF",
            "volume.volume ma.transparency": 30,
            "volume.show ma": false,
          },
        });
      }, 50);
    }).catch((err) => {
      console.error("Failed to load TradingView:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

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
          <div id={containerId.current} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
