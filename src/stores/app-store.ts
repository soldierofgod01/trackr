import { create } from "zustand";
import { RadarView, FilterState } from "@/types";

interface AppStore {
  activeModule: string;
  setActiveModule: (m: string) => void;
  radarView: RadarView;
  setRadarView: (v: RadarView) => void;
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: any) => void;
  watchlist: string[];
  toggleWatchlist: (marketId: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  walletAddress: string | null;
  setWalletAddress: (a: string | null) => void;
  portfolioPeriod: string;
  setPortfolioPeriod: (p: string) => void;
  // Scanner
  scannerScreen: string;
  setScannerScreen: (s: string) => void;
  scannerCategory: string;
  setScannerCategory: (c: string) => void;
  scannerSort: string;
  setScannerSort: (s: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeModule: "pressure",
  setActiveModule: (m) => set({ activeModule: m }),
  radarView: "leaderboard",
  setRadarView: (v) => set({ radarView: v }),
  filters: { tier: "all", category: "all", minTradeSize: 0, side: "all" },
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  watchlist: [],
  toggleWatchlist: (id) =>
    set((s) => ({
      watchlist: s.watchlist.includes(id)
        ? s.watchlist.filter((x) => x !== id)
        : [...s.watchlist, id],
    })),
  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  walletAddress: null,
  setWalletAddress: (a) => set({ walletAddress: a }),
  portfolioPeriod: "1M",
  setPortfolioPeriod: (p) => set({ portfolioPeriod: p }),
  scannerScreen: "all",
  setScannerScreen: (s) => set({ scannerScreen: s }),
  scannerCategory: "all",
  setScannerCategory: (c) => set({ scannerCategory: c }),
  scannerSort: "volume_24h",
  setScannerSort: (s) => set({ scannerSort: s }),
}));
