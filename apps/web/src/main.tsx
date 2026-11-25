import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { MotionConfig } from "motion/react";
import { HomePage } from "./home/HomePage";
import "./app.css";
import { installAudioLifecycle } from "./audio/mixer";
import { getSettings, subscribeSettings, useSetting } from "./settings/settings";
import { installPwa } from "./pwa/install";

// Audio starts on the first tap or key press and pauses while the tab is hidden.
installAudioLifecycle();
// Keeps the install prompt, and registers the offline worker in production.
installPwa();
// CSS reads the racer's own motion choice from here; the device setting has its own media query.
const applyMotion = () => {
  document.documentElement.dataset.motion = getSettings().motion;
};
applyMotion();
subscribeSettings(applyMotion);

const PracticePage = lazy(() =>
  import("./practice/PracticePage").then((m) => ({ default: m.PracticePage })),
);
const DrivingSchool = lazy(() =>
  import("./practice/DrivingSchool").then((m) => ({ default: m.DrivingSchool })),
);
const PlayPage = lazy(() =>
  import("./online/PlayPage").then((m) => ({ default: m.PlayPage })),
);
const RoomPage = lazy(() =>
  import("./online/RoomPage").then((m) => ({ default: m.RoomPage })),
);
const SettingsPage = lazy(() =>
  import("./settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
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

function App() {
  const reduce = useSetting((value) => value.motion === "reduce");
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/school" element={<DrivingSchool />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/r/:code" element={<RoomPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
