"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type FallingPatternProps = React.ComponentProps<"div"> & {
  color?: string;
  backgroundColor?: string;
  duration?: number;        // unused — kept for prop compat
  blurIntensity?: string;   // unused — kept for prop compat
  density?: number;         // unused — kept for prop compat
};

/**
 * Falling pattern: canvas-driven streaks of light dropping down a dim dot-grid.
 * Lots of visible motion — streaks of varying length, speed, and brightness fall
 * over a subtle static dot grid texture.
 *
 * Why canvas instead of CSS:
 * - Many simultaneous independent streaks (the previous CSS attempts capped at 5-10)
 * - Per-pixel control over brightness and trail length
 * - Cheaper than 100 animated divs
 */
export function FallingPattern({
  color = "rgba(255,255,255,0.85)",
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

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Streaks: drops of light falling at varying speeds
    interface Streak {
      x: number;
      y: number;
      speed: number;        // px/s
      length: number;       // trail length
      brightness: number;   // 0-1
      width: number;        // line thickness
    }

    const STREAK_COUNT = Math.floor((width * height) / 14000); // density tuned for ~80 streaks on a 1440x900 screen
    const streaks: Streak[] = [];

    const spawnStreak = (offscreen = true): Streak => {
      const speed = 80 + Math.random() * 220; // 80-300 px/s
      return {
        x: Math.random() * width,
        // If offscreen=true, spawn above the canvas; otherwise scatter for initial fill
        y: offscreen ? -Math.random() * 400 : Math.random() * height,
        speed,
        length: 30 + Math.random() * 100,
        brightness: 0.25 + Math.random() * 0.75,
        width: 1 + Math.random() * 1.4,
      };
    };

    // Initial scatter so the screen isn't empty for the first second
    for (let i = 0; i < STREAK_COUNT; i++) {
      streaks.push(spawnStreak(false));
    }

    // Static dot grid pattern (drawn once to an offscreen canvas, then blitted each frame)
    const gridCanvas = document.createElement("canvas");
    gridCanvas.width = width;
    gridCanvas.height = height;
    const gridCtx = gridCanvas.getContext("2d");
    if (gridCtx) {
      const dotSpacing = 14;
      gridCtx.fillStyle = "rgba(255,255,255,0.13)";
      for (let y = 0; y < height + dotSpacing; y += dotSpacing) {
        for (let x = 0; x < width + dotSpacing; x += dotSpacing) {
          gridCtx.beginPath();
          gridCtx.arc(x, y, 0.9, 0, Math.PI * 2);
          gridCtx.fill();
        }
      }
    }

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(50, now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Clear
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Background dot grid
      ctx.drawImage(gridCanvas, 0, 0, width, height);

      // Streaks
      for (const s of streaks) {
        s.y += s.speed * dt;

        // Respawn when fully offscreen below
        if (s.y - s.length > height) {
          Object.assign(s, spawnStreak(true));
          continue;
        }

        // Draw streak as a gradient line for tail-fade effect
        const grad = ctx.createLinearGradient(s.x, s.y - s.length, s.x, s.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.7, `rgba(255,255,255,${s.brightness * 0.5})`);
        grad.addColorStop(1, `rgba(255,255,255,${s.brightness})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.length);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Bright head — small glow dot at the tip
        ctx.fillStyle = `rgba(255,255,255,${s.brightness})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.width * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [color, backgroundColor]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} style={{ backgroundColor }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
