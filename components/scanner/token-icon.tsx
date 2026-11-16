"use client";

import { useState } from "react";

// ─── Token icon with letter-circle fallback ───
// Uses the cryptocurrency-icons CDN (public, free, no API key needed).
// HL k-prefix tokens (KPEPE, KBONK, etc.) strip the leading K to share the
// base token's icon. If the icon doesn't exist on the CDN, onError swaps to
// a letter circle automatically.
//
// Note: the icon set is opinionated and covers most majors and popular alts.
// Long-tail HL-only tokens (some memecoins, very new perps) will fallback
// to the letter circle — that's expected.

function normalizeForIcon(symbol: string): string {
  // Strip HL's k-prefix for high-supply tokens
  let s = symbol.toLowerCase();
  if (s.startsWith("k") && s.length > 1 && s[1] >= "a" && s[1] <= "z") {
    s = s.slice(1);
  }
  return s;
}

const CDN_BASE = "https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1.0.0/svg/color";

interface Props {
  symbol: string;
  size?: number;
}

export function TokenIcon({ symbol, size = 28 }: Props) {
  const [failed, setFailed] = useState(false);
  const slug = normalizeForIcon(symbol);
  const url = `${CDN_BASE}/${slug}.svg`;

  if (failed) {
    return (
      <div
        className="rounded-full bg-elevated border border-border flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        <span className="ds-num text-[11px] font-bold text-txt-secondary">
          {symbol.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-full bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {/* Plain img — no Next/Image, no domain config needed for external CDN */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
