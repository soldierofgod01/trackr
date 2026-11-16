"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CvdPoint } from "@/lib/hooks/use-orderflow";
import { fmtUsd } from "@/lib/bias/engine";

// Session CVD (mint, right scale) against price (grey, left scale).
// Divergence between the two lines is the thing to look at.
export function CvdChart({ data }: { data: CvdPoint[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const cvdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const pxRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = createChart(elRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6B6B72",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      rightPriceScale: { borderVisible: false },
      leftPriceScale: { visible: true, borderVisible: false },
      // Local time, to match the prints list and the user's clock (default is UTC).
      localization: {
        timeFormatter: (t: number) =>
          new Date(t * 1000).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (t: number) =>
          new Date(t * 1000).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" }),
      },
      handleScroll: false,
      handleScale: false,
    });
    cvdRef.current = chart.addSeries(LineSeries, {
      color: "#33FFA3",
      lineWidth: 2,
      priceScaleId: "right",
      priceLineVisible: false,
      priceFormat: { type: "custom", formatter: (v: number) => fmtUsd(v), minMove: 1 },
    });
    pxRef.current = chart.addSeries(LineSeries, {
      color: "rgba(237,237,239,0.35)",
      lineWidth: 1,
      priceScaleId: "left",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cvdRef.current || !pxRef.current) return;
    try {
      cvdRef.current.setData(data.map((p) => ({ time: p.time as UTCTimestamp, value: p.cvd })));
      pxRef.current.setData(data.map((p) => ({ time: p.time as UTCTimestamp, value: p.px })));
      chartRef.current?.timeScale().fitContent();
    } catch {
      /* out-of-order point — skip this frame */
    }
  }, [data]);

  return <div ref={elRef} className="w-full h-full" />;
}
