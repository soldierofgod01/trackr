"use client";

// App-level error boundary. If any module throws during render, this shows
// a clean in-app screen instead of Vercel's bare "This page couldn't load".
// Next.js automatically wraps the app with this file.

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the browser console for debugging
    console.error("Mako app error:", error);
  }, [error]);

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg-base">
      <div className="max-w-[420px] text-center px-6">
        <div className="text-[15px] font-semibold text-txt-primary mb-2">
          Something went wrong
        </div>
        <p className="text-[13px] text-txt-secondary leading-[1.5] mb-5">
          A module failed to load. This is usually temporary — try again.
        </p>
        <button
          onClick={reset}
          className="px-4 h-9 rounded-[8px] bg-txt-primary text-bg-base text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
