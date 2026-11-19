import { create } from "zustand";

import { emptyCalcView, type CalcMode, type CalcView } from "../lib/ipc";

interface CalcState {
  views: Partial<Record<CalcMode, CalcView>>;
  setView: (view: CalcView) => void;
  resetView: (mode: CalcMode) => void;
}

/** Frontend mirror of the Rust session state, kept per mode so route changes
 * do not lose the last rendered view. The engine remains authoritative. */
export const useCalcStore = create<CalcState>()((set) => ({
  views: {},
  setView: (view) =>
    set((state) => ({ views: { ...state.views, [view.mode]: view } })),
  resetView: (mode) =>
    set((state) => ({ views: { ...state.views, [mode]: emptyCalcView(mode) } })),
}));
