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
 * Falling pattern: fine pixel dust.
 *
 * A grid of tiny square pixels falling down the screen. Pixels are small
 * (2px), monochrome with subtle brightness variation, and fall at varied
 * speeds for depth. Quiet, textural — sits behind content without competing.
 */
export function FallingPattern({
  backgroundColor = "#08080A",
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

    // Pixel dust config
    const PIXEL = 2;            // size of each square pixel, in px
    const GAP = 14;             // horizontal spacing between pixel columns
    let columnCount = 0;

    interface Pixel {
      x: number;
      y: number;
      speed: number;     // px/s
      brightness: number; // 0..1
      blink: number;      // phase for subtle opacity flicker
    }

    let pixels: Pixel[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      columnCount = Math.ceil(width / GAP);
      initPixels();
    };

    const initPixels = () => {
      pixels = [];
      // ~3 pixels per column on screen at any time, staggered
      for (let c = 0; c < columnCount; c++) {
        const colX = c * GAP + GAP / 2;
        const perCol = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < perCol; i++) {
          pixels.push(makePixel(colX, Math.random() * height));
        }
      }
    };

    const makePixel = (x: number, y: number): Pixel => ({
      x,
      y,
      speed: 18 + Math.random() * 55,        // slow, varied — gentle drift
      brightness: 0.12 + Math.random() * 0.55,
      blink: Math.random() * Math.PI * 2,
    });

    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(50, now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      ctx.clearRect(0, 0, width, height);

      for (const p of pixels) {
        p.y += p.speed * dt;
        p.blink += dt * 1.5;

        // Recycle pixel to the top when it falls off the bottom
        if (p.y > height + PIXEL) {
          p.y = -PIXEL - Math.random() * 40;
          p.speed = 18 + Math.random() * 55;
          p.brightness = 0.12 + Math.random() * 0.55;
        }

        // Subtle opacity flicker so the field feels alive
        const flicker = 0.75 + Math.sin(p.blink) * 0.25;
        const alpha = p.brightness * flicker;

        // Monochrome cool-white pixels
        ctx.fillStyle = `rgba(180, 190, 210, ${alpha})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), PIXEL, PIXEL);
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ backgroundColor }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
