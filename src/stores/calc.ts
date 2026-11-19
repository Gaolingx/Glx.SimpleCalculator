import { create } from "zustand";

import {
  calcCommand,
  emptyCalcView,
  type CalcCommand,
  type CalcMode,
  type CalcView,
} from "../lib/ipc";

interface CalcState {
  views: Partial<Record<CalcMode, CalcView>>;
  setView: (view: CalcView) => void;
  resetView: (mode: CalcMode) => void;
  dispatch: (command: CalcCommand) => Promise<CalcView>;
}

/** Frontend mirror of the Rust session state, kept per mode so route changes
 * do not lose the last rendered view. The engine remains authoritative. */
export const useCalcStore = create<CalcState>()((set) => ({
  views: {},
  setView: (view) =>
    set((state) => ({ views: { ...state.views, [view.mode]: view } })),
  resetView: (mode) =>
    set((state) => ({ views: { ...state.views, [mode]: emptyCalcView(mode) } })),
  dispatch: async (command) => {
    const view = await calcCommand(command);
    set((state) => ({ views: { ...state.views, [view.mode]: view } }));
    return view;
  },
}));
