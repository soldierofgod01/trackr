"use client";
import { MOCK_INSIGHTS } from "@/lib/mock-data";
import { useAppStore } from "@/stores/app-store";

export function InsightsRow() {
  const { setActiveModule } = useAppStore();

  return (
    <div className="grid md:grid-cols-2 gap-3 mt-[22px]">
      {MOCK_INSIGHTS.map((insight, i) => {
        const borderColor =
          insight.kind === "warn"
            ? "border-l-warning"
            : insight.kind === "edge"
            ? "border-l-positive"
            : "border-l-txt-dim";
        const tagColor =
          insight.kind === "warn"
            ? "bg-warning/10 text-warning"
            : insight.kind === "edge"
            ? "bg-positive/10 text-positive"
            : "bg-surface-2 text-txt-secondary";
        const tagLabel =
          insight.kind === "warn" ? "Watch" : insight.kind === "edge" ? "Edge" : "Info";

        return (
          <div
            key={i}
            className={`bg-[#0A0A0A] border border-border border-l-[2px] ${borderColor} rounded-[10px] p-[14px_18px] flex items-start gap-3`}
          >
            <span
              className={`font-mono text-[9.5px] font-semibold px-[6px] py-0.5 rounded ${tagColor} uppercase tracking-[0.06em] flex-shrink-0 mt-0.5`}
            >
              {tagLabel}
            </span>
            <div className="flex-1">
              <h5 className="text-[12.5px] font-semibold mb-[3px] tracking-[-0.005em]">
                {insight.title}
              </h5>
              <p className="text-[11.5px] text-txt-muted leading-[1.4]">
                {insight.body}
                {insight.link && (
                  <>
                    {" "}
                    <button
                      onClick={() => setActiveModule(insight.link!.view)}
                      className="text-txt-secondary hover:text-txt-primary underline underline-offset-2 decoration-txt-dim"
                    >
                      {insight.link.label}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
