import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./app/App";
import "./style.css";

async function mount() {
  const localSplits =
    import.meta.env.DEV && __LOCAL_SPLIT_SCENARIOS__
      ? (await import("./dev/splitScenarios")).localSplits
      : undefined;
  createRoot(document.getElementById("root")!).render(
    <MotionConfig reducedMotion="user">
      <App localSplits={localSplits} />
    </MotionConfig>,
  );
}
void mount();
