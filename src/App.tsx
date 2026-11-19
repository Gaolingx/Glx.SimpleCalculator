import { ToastProvider } from "./components/ui";
import { GalleryPage } from "./features/dev/GalleryPage";

export default function App() {
  return (
    <ToastProvider>
      <GalleryPage />
    </ToastProvider>
  );
}
