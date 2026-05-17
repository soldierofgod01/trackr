"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FallingPattern } from "@/components/ui/falling-pattern";
import { ModuleCard } from "@/components/ui/module-card";
import { useAppStore } from "@/stores/app-store";
import {
  Waves,
  ScanSearch,
  Anchor,
  Briefcase,
  Bell,
} from "lucide-react";

type Stage = "intro" | "hub";

const modules = [
  {
    id: "pressure",
    label: "Flow Pressure",
    tagline: "Score 0–100",
    desc: "Where capital is positioning across every HL perp.",
    icon: Waves,
  },
  {
    id: "whale-flow",
    label: "Whale Flow",
    tagline: "Smart money",
    desc: "Live positions and trades from top HL whales.",
    icon: Anchor,
  },
  {
    id: "scanner",
    label: "Scanner",
    tagline: "Token screener",
    desc: "Filter tokens by volume, OI, funding rates.",
    icon: ScanSearch,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    tagline: "Your positions",
    desc: "Multi-chain P&L, exposure, calibration.",
    icon: Briefcase,
  },
  {
    id: "alerts",
    label: "Alerts",
    tagline: "Live signals",
    desc: "Price targets, liq warnings, plan drift.",
    icon: Bell,
  },
];

export function LandingScreen({ onEnter }: { onEnter: () => void }) {
  const { setActiveModule } = useAppStore();
  const [stage, setStage] = useState<Stage>("intro");

  const goToHub = () => {
    if (stage === "intro") setStage("hub");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === "hub") setStage("intro");
      // Enter advances from intro → hub. Trader-friendly keyboard navigation.
      if ((e.key === "Enter" || e.key === " ") && stage === "intro") {
        e.preventDefault();
        goToHub();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const selectModule = (id: string) => {
    setActiveModule(id);
    onEnter();
  };

  return (
    <div
      className="h-screen w-screen relative overflow-hidden bg-[#0a0a0a]"
    >
      {/* Falling pattern background — canvas streaks + dot grid texture */}
      <div className="absolute inset-0 pointer-events-none">
        <FallingPattern
          backgroundColor="#0a0a0a"
          className="h-screen w-screen [mask-image:radial-gradient(ellipse_at_center,white_60%,rgba(255,255,255,0.7)_90%,rgba(255,255,255,0.4)_100%)]"
        />
      </div>

      {/* Subtle center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(16,185,129,0.04) 0%, rgba(59,130,246,0.03) 35%, transparent 70%)",
        }}
      />

      {/* Scanlines accent (very subtle) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] z-[2]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 4px)",
        }}
      />

      <AnimatePresence mode="popLayout">
        {stage === "intro" ? (
          <IntroStage key="intro" onEnter={goToHub} />
        ) : (
          <HubStage key="hub" onSelect={selectModule} onBack={() => setStage("intro")} />
        )}
      </AnimatePresence>
    </div>
  );
}

function IntroStage({ onEnter }: { onEnter: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.05, filter: "blur(12px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.92, y: -40, filter: "blur(8px)" }}
      transition={{
        duration: 0.7,
        ease: [0.32, 0.72, 0.24, 1],
      }}
      className="relative z-10 h-full w-full flex flex-col items-center justify-center"
    >
      {/* Top tag */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-white/40"
      >
        <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
        <span>A quant terminal for crypto traders</span>
      </motion.div>

      {/* Main text */}
      <div className="flex flex-col items-center gap-5 px-6">
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "-0.02em", y: 16 }}
          animate={{ opacity: 1, letterSpacing: "-0.04em", y: 0 }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.22, 0.9, 0.26, 1] }}
          className="text-white text-[clamp(70px,15vw,180px)] leading-none font-black tracking-[-0.04em]"
          style={{ fontFamily: '"Kdam Thmor Pro", sans-serif' }}
        >
          TRACKR
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7 }}
          className="text-white/50 text-[14px] md:text-[15px] tracking-[0.06em] font-light uppercase"
        >
          Crypto Trading Intelligence
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="w-[120px] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent origin-center mt-1"
        />
      </div>

      {/* Bottom hint + stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.7 }}
        className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-5"
      >
        <button
          onClick={onEnter}
          className="group flex items-center gap-3 text-white/70 hover:text-white text-[11px] font-mono uppercase tracking-[0.25em] transition-colors cursor-pointer"
        >
          <span>Press</span>
          <kbd className="px-2.5 py-1 rounded border border-white/25 group-hover:border-white/60 bg-white/[0.04] group-hover:bg-white/[0.08] text-white/80 group-hover:text-white text-[11px] font-mono tracking-[0.15em] transition-colors">
            Enter
          </kbd>
          <span>to open app</span>
        </button>

        <div className="flex items-center gap-8 text-white/30 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-emerald-400/70 animate-pulse" />
            <span>LIVE · 500 WALLETS TRACKED</span>
          </div>
          <div className="hidden md:block">·</div>
          <div className="hidden md:block">847 ACTIVE MARKETS</div>
          <div className="hidden md:block">·</div>
          <div className="hidden md:block">$10B+ VOLUME</div>
        </div>
      </motion.div>

      {/* Corner markers (quant terminal accent) */}
      <CornerMarkers />
    </motion.div>
  );
}

function HubStage({
  onSelect,
  onBack,
}: {
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.03, y: 24, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.98, y: 12, filter: "blur(8px)" }}
      transition={{
        duration: 0.8,
        ease: [0.22, 0.9, 0.26, 1],
        delay: 0.15,
      }}
      className="relative z-10 h-full w-full flex flex-col items-center justify-center px-6"
    >
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="absolute top-8 left-0 right-0 px-10 flex items-center justify-between"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.15em] text-white/40 hover:text-white/80 transition-colors"
        >
          ← back
        </button>
        <div
          className="text-[18px] font-black tracking-[-0.04em] text-white"
          style={{ fontFamily: '"Kdam Thmor Pro", sans-serif' }}
        >
          TRACKR
        </div>
        <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-white/40">
          <span className="inline-block w-1 h-1 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          session 01
        </div>
      </motion.div>

      {/* Heading */}
      <div className="text-center mb-12 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-[11px] font-mono uppercase tracking-[0.3em] text-emerald-400/70 mb-3"
        >
          — select module —
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-white text-[34px] md:text-[42px] font-semibold tracking-[-0.03em] leading-[1.1]"
        >
          Where do you want to start?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-white/40 text-[13px] mt-3"
        >
          Access any module. You can switch anytime.
        </motion.p>
      </div>

      {/* Module grid — dashed divider style, animated grid patterns per card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 w-full max-w-[1100px] divide-x divide-y divide-dashed divide-white/[0.08] border border-dashed border-white/[0.08] rounded-[14px] overflow-hidden bg-white/[0.015] backdrop-blur-sm">
        {modules.map((m, i) => (
          <ModuleCard
            key={m.id}
            module={m}
            index={i}
            onClick={() => onSelect(m.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] text-white/25"
      >
        <span>v0.1.0</span>
        <span>·</span>
        <span>beta</span>
        <span>·</span>
        <span>press esc to return</span>
      </motion.div>

      <CornerMarkers />
    </motion.div>
  );
}

function CornerMarkers() {
  const size = 18;
  return (
    <>
      {/* Top left */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
          <path d="M0 0 L0 18 M0 0 L18 0" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </svg>
      </div>
      {/* Top right */}
      <div className="absolute top-4 right-4 pointer-events-none">
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
          <path d="M18 0 L18 18 M18 0 L0 0" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </svg>
      </div>
      {/* Bottom left */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
          <path d="M0 18 L0 0 M0 18 L18 18" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </svg>
      </div>
      {/* Bottom right */}
      <div className="absolute bottom-4 right-4 pointer-events-none">
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
          <path d="M18 18 L18 0 M18 18 L0 18" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </svg>
      </div>
    </>
  );
}
