import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { LocaleProvider } from "./i18n/LocaleProvider";
import App from "./app/App";
import "./style.css";

async function mount() {
  const localSplits =
    import.meta.env.DEV && __LOCAL_SPLIT_SCENARIOS__
      ? (await import("./dev/splitScenarios")).localSplits
      : undefined;
  createRoot(document.getElementById("root")!).render(
    <MotionConfig reducedMotion="user">
      <LocaleProvider>
        <App localSplits={localSplits} />
      </LocaleProvider>
    </MotionConfig>,
  );
}
void mount();
