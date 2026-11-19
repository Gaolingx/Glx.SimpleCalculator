import { AppShell } from "./app/AppShell";
import { ToastProvider } from "./components/ui";

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
