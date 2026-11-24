import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { HomePage } from "./home/HomePage";
import "./app.css";
import { installAudioLifecycle } from "./audio/mixer";

// Audio starts on the first tap or key press and pauses while the tab is hidden.
installAudioLifecycle();

const PracticePage = lazy(() =>
  import("./practice/PracticePage").then((m) => ({ default: m.PracticePage })),
);
const PlayPage = lazy(() =>
  import("./online/PlayPage").then((m) => ({ default: m.PlayPage })),
);
const RoomPage = lazy(() =>
  import("./online/RoomPage").then((m) => ({ default: m.RoomPage })),
);

function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <p role="status" className="text-lg text-muted">
        Warming up the engines…
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/r/:code" element={<RoomPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
