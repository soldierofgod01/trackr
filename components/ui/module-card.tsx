"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

type ModuleData = {
  id: string;
  label: string;
  tagline: string;
  desc: string;
  icon: LucideIcon;
};

type ModuleCardProps = React.ComponentProps<"button"> & {
  module: ModuleData;
  index: number;
};

// ════════════════════════════════════════════════════════════════
// Card with animated grid pattern (adapted for dark terminal)
// ════════════════════════════════════════════════════════════════
export function ModuleCard({
  module: m,
  index,
  className,
  ...props
}: ModuleCardProps) {
  // Per-card random pattern — changes the position of bright squares
  const pattern = React.useMemo(() => genRandomPattern(), []);
  const Icon = m.icon;

  return (
    <motion.button
      onClick={props.onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        opacity: { delay: 0.25 + index * 0.05, duration: 0.45 },
        y: { delay: 0.25 + index * 0.05, duration: 0.5, ease: [0.22, 0.9, 0.26, 1] },
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "group relative overflow-hidden text-left",
        "p-6 transition-colors duration-300",
        "hover:bg-white/[0.02]",
        className
      )}
    >
      {/* Animated grid pattern background */}
      <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full [mask-image:linear-gradient(white,transparent)]">
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.04] to-white/[0.01] [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] opacity-100">
          <GridPattern
            width={20}
            height={20}
            x="-12"
            y="4"
            squares={pattern}
            className="absolute inset-0 h-full w-full mix-blend-overlay fill-white/[0.05] stroke-white/[0.18]"
          />
        </div>
      </div>

      {/* Hover accent glow — emerald, on-brand */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)",
          }}
        />
      </div>

      {/* Module number — top right */}
      <div className="absolute top-4 right-4 text-[10px] font-mono text-white/20 tracking-wider z-10">
        0{index + 1}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Icon
          className="text-white/75 group-hover:text-white transition-colors size-6"
          strokeWidth={1.5}
          aria-hidden
        />

        <div className="mt-9">
          <div className="text-[15px] font-semibold text-white tracking-[-0.01em] leading-tight">
            {m.label}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-emerald-400/70 mt-1.5">
            {m.tagline}
          </div>
        </div>

        <p className="text-[11.5px] text-white/45 leading-[1.5] font-light mt-2.5">
          {m.desc}
        </p>

        {/* Arrow indicator on hover */}
        <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
          <ArrowUpRight className="w-[14px] h-[14px] text-white/60" />
        </div>
      </div>
    </motion.button>
  );
}

// ════════════════════════════════════════════════════════════════
// Grid pattern SVG
// ════════════════════════════════════════════════════════════════
function GridPattern({
  width,
  height,
  x,
  y,
  squares,
  ...props
}: React.ComponentProps<"svg"> & {
  width: number;
  height: number;
  x: string;
  y: string;
  squares?: number[][];
}) {
  const patternId = React.useId();

  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sx, sy], i) => (
            <rect
              strokeWidth="0"
              key={i}
              width={width + 1}
              height={height + 1}
              x={sx * width}
              y={sy * height}
            />
          ))}
        </svg>
      )}
    </svg>
  );
}

function genRandomPattern(length?: number): number[][] {
  length = length ?? 5;
  return Array.from({ length }, () => [
    Math.floor(Math.random() * 4) + 7,
    Math.floor(Math.random() * 6) + 1,
  ]);
}
