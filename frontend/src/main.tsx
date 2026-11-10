import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./app/App";
import "./style.css";

if (
  import.meta.env.DEV &&
  __LOCAL_SPLIT_LAB__ &&
  window.location.pathname === "/__dev/hashmap-split"
) {
  void import("./dev/HashMapSplitLab").then((m) => m.mountSplitLab());
} else
  createRoot(document.getElementById("root")!).render(
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>,
  );
