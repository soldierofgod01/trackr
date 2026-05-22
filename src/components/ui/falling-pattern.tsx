"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type FallingPatternProps = React.ComponentProps<"div"> & {
  color?: string;
  backgroundColor?: string;
  duration?: number;
  blurIntensity?: string;
  density?: number;
};

/**
 * Falling pattern: Matrix-style character rain.
 *
 * Vertical columns of falling glyphs — numbers, hex chars, candlestick chars.
 * Lead character is bright white, trail fades to dim green. Crypto-terminal vibe.
 */
export function FallingPattern({
  backgroundColor = "#0a0a0a",
  className,
}: FallingPatternProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Hex digits + arrows + a few terminal glyphs. Skewed toward numbers since
    // this is meant to feel like prices/data on a terminal.
    const CHARS = "0123456789ABCDEF0123456789▲▼▴▾░▒▓│┃┆┊╎╏┄┈⎯─";
    const charArr = CHARS.split("");

    let width = 0;
    let height = 0;
    let dpr = 1;
    const fontSize = 14;
    let columnWidth = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      columnWidth = fontSize;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Column {
      x: number;
      headY: number;
      speed: number;
      trailLength: number;
      charsBuffer: string[];
      changeChance: number;
    }

    const columns: Column[] = [];

    const spawnColumn = (col: Column, initialFill = false) => {
      const trailLength = 8 + Math.floor(Math.random() * 18);
      col.headY = initialFill
        ? Math.random() * height
        : -fontSize * trailLength - Math.random() * 200;
      col.speed = 60 + Math.random() * 140;
      col.trailLength = trailLength;
      col.changeChance = 0.04 + Math.random() * 0.1;
      col.charsBuffer = Array.from({ length: trailLength + 1 }, () =>
        charArr[Math.floor(Math.random() * charArr.length)]
      );
    };

    const initColumns = () => {
      columns.length = 0;
      const colCount = Math.ceil(width / columnWidth);
      for (let i = 0; i < colCount; i++) {
        if (Math.random() < 0.7) {
          const col: Column = {
            x: i * columnWidth,
            headY: 0,
            speed: 0,
            trailLength: 0,
            charsBuffer: [],
            changeChance: 0.06,
          };
          spawnColumn(col, true);
          columns.push(col);
        }
      }
    };
    initColumns();

    ctx.textBaseline = "top";
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(50, now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Semi-transparent fill creates the trail fade-out behind glyphs.
      ctx.fillStyle =
        backgroundColor === "#0a0a0a"
          ? "rgba(10,10,10,0.18)"
          : `${backgroundColor}30`;
      ctx.fillRect(0, 0, width, height);

      for (const col of columns) {
        col.headY += col.speed * dt;

        // Random mutation keeps the rain "alive" rather than static repetition
        for (let i = 0; i < col.charsBuffer.length; i++) {
          if (Math.random() < col.changeChance * dt * 12) {
            col.charsBuffer[i] = charArr[Math.floor(Math.random() * charArr.length)];
          }
        }

        for (let i = 0; i < col.charsBuffer.length; i++) {
          const ageFromHead = col.charsBuffer.length - 1 - i;
          const y = col.headY - ageFromHead * fontSize;
          if (y < -fontSize || y > height + fontSize) continue;

          if (ageFromHead === 0) {
            ctx.fillStyle = "rgba(220, 255, 235, 0.95)";
          } else if (ageFromHead === 1) {
            ctx.fillStyle = "rgba(140, 220, 180, 0.7)";
          } else {
            const fade = Math.max(0, 1 - ageFromHead / col.charsBuffer.length);
            ctx.fillStyle = `rgba(60, 180, 130, ${fade * 0.55})`;
          }
          ctx.fillText(col.charsBuffer[i], col.x, y);
        }

        if (col.headY - col.charsBuffer.length * fontSize > height) {
          spawnColumn(col, false);
        }
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [backgroundColor]);

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ backgroundColor }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
