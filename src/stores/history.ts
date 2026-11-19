import { create } from "zustand";

import {
  addHistory,
  clearHistory,
  deleteHistory,
  fetchHistory,
  toIpcError,
  type CalcMode,
  type HistoryEntry,
  type HistoryInput,
  type IpcError,
} from "../lib/ipc";

interface HistoryState {
  entries: HistoryEntry[];
  loaded: boolean;
  loading: boolean;
  error: IpcError | null;
  refresh: () => Promise<void>;
  record: (input: HistoryInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: (mode: CalcMode) => Promise<void>;
}

/** Mirrors the Rust history store; all writes go through IPC so the file
 * stays the single source of truth. */
export const useHistoryStore = create<HistoryState>()((set) => ({
  entries: [],
  loaded: false,
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const entries = await fetchHistory();
      set({ entries, loaded: true, loading: false });
    } catch (error) {
      set({ loading: false, error: toIpcError(error) });
    }
  },

  record: async (input) => {
    try {
      const entries = await addHistory(input);
      set({ entries, loaded: true, error: null });
    } catch (error) {
      set({ error: toIpcError(error) });
    }
  },

  remove: async (id) => {
    try {
      const entries = await deleteHistory(id);
      set({ entries, error: null });
    } catch (error) {
      set({ error: toIpcError(error) });
    }
  },

  clear: async (mode) => {
    try {
      const entries = await clearHistory(mode);
      set({ entries, error: null });
    } catch (error) {
      set({ error: toIpcError(error) });
    }
  },
}));