import { create } from "zustand";

export type OverlayId = "settings" | "history";

interface UiState {
  overlay: OverlayId | null;
  openOverlay: (overlay: OverlayId) => void;
  closeOverlay: () => void;
  toggleOverlay: (overlay: OverlayId) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  overlay: null,
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null }),
  toggleOverlay: (overlay) =>
    set({ overlay: get().overlay === overlay ? null : overlay }),
}));
