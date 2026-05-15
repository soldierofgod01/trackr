"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import {
  Waves,
  ScanSearch,
  Briefcase,
  ShieldAlert,
  Bell,
  ChevronLeft,
  ChevronRight,
  Search,
  HelpCircle,
} from "lucide-react";

const modules = [
  { id: "pressure", label: "Pressure", icon: Waves, color: "text-radar" },
  { id: "scanner", label: "Scanner", icon: ScanSearch, color: "text-scanner" },
  { id: "portfolio", label: "Portfolio", icon: Briefcase, color: "text-portfolio" },
  { id: "risk", label: "Risk", icon: ShieldAlert, color: "text-risk" },
  { id: "alerts", label: "Alerts", icon: Bell, color: "text-alerts" },
];

export function SideNav() {
  const { activeModule, setActiveModule } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapsed state across page loads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("trackr:sidenav:collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("trackr:sidenav:collapsed", next ? "1" : "0");
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col bg-surface-0 border-r border-border transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-[200px]"
      )}
    >
      {/* Logo block */}
      <div
        className={cn(
          "h-14 flex items-center border-b border-border px-3 shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-radar/15 flex items-center justify-center shrink-0">
            <Waves className="w-4 h-4 text-radar" />
          </div>
          {!collapsed && (
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-sans font-bold text-[15px] tracking-tight">TRACKR</span>
              <span className="text-[9.5px] text-txt-muted font-mono uppercase tracking-[0.1em]">
                beta
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Module list */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="flex flex-col gap-0.5">
          {modules.map((m) => {
            const Icon = m.icon;
            const active = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                title={collapsed ? m.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 h-9 rounded-md text-[13px] font-medium transition-colors duration-100",
                  collapsed ? "justify-center px-0" : "px-2.5",
                  active
                    ? "bg-surface-2 text-txt-primary"
                    : "text-txt-secondary hover:text-txt-primary hover:bg-surface-1"
                )}
              >
                {/* Active indicator bar on the left */}
                {active && (
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r",
                      m.color.replace("text-", "bg-")
                    )}
                  />
                )}
                <Icon
                  className={cn(
                    "w-[16px] h-[16px] shrink-0",
                    active ? m.color : "text-txt-secondary group-hover:text-txt-primary"
                  )}
                />
                {!collapsed && <span className="truncate">{m.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer block — search, help, collapse toggle */}
      <div className="border-t border-border p-2 flex flex-col gap-0.5 shrink-0">
        <button
          title={collapsed ? "Search" : undefined}
          className={cn(
            "flex items-center gap-3 h-9 rounded-md text-[13px] text-txt-secondary hover:text-txt-primary hover:bg-surface-1 transition-colors",
            collapsed ? "justify-center px-0" : "px-2.5"
          )}
        >
          <Search className="w-[16px] h-[16px] shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="text-[10px] font-mono text-txt-muted bg-surface-2 border border-border rounded px-1.5 py-0.5">
                /
              </kbd>
            </>
          )}
        </button>

        <button
          title={collapsed ? "Help" : undefined}
          className={cn(
            "flex items-center gap-3 h-9 rounded-md text-[13px] text-txt-secondary hover:text-txt-primary hover:bg-surface-1 transition-colors",
            collapsed ? "justify-center px-0" : "px-2.5"
          )}
        >
          <HelpCircle className="w-[16px] h-[16px] shrink-0" />
          {!collapsed && <span className="truncate">Help</span>}
        </button>

        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-3 h-9 rounded-md text-[13px] text-txt-muted hover:text-txt-primary hover:bg-surface-1 transition-colors mt-1",
            collapsed ? "justify-center px-0" : "px-2.5"
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-[16px] h-[16px] shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-[16px] h-[16px] shrink-0" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
