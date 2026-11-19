import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { initI18n } from "./i18n";
import {
  applyTheme,
  applyUiZoom,
  installUiScaleSync,
  readStoredTheme,
  syncUiScale,
} from "./lib";
import { useSettingsStore } from "./stores/settings";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("root element is missing");
}
const root = createRoot(container);

async function bootstrap(): Promise<void> {
  applyTheme(readStoredTheme());
  applyUiZoom(useSettingsStore.getState().settings.uiZoom);
  await initI18n();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  void useSettingsStore.getState().hydrate();
  void syncUiScale();
  installUiScaleSync();
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  container.textContent = message;
});
