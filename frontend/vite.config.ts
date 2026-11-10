import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  define: {
    __LOCAL_SPLIT_SCENARIOS__: JSON.stringify(command === "serve"),
    __APP_VERSION__: JSON.stringify(
      execFileSync(
        "sh",
        [fileURLToPath(new URL("../scripts/git-version.sh", import.meta.url))],
        {
          encoding: "utf8",
        },
      ).trim(),
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "exclude-local-split-scenarios",
      generateBundle(_options, bundle) {
        for (const item of Object.values(bundle)) {
          const content =
            item.type === "chunk" ? item.code : String(item.source);
          if (/splitScenarios|local-split-[26]-7|Локально: split/.test(content))
            this.error("Local split scenarios must never be published");
        }
      },
    },
  ],
  server: { proxy: { "/api": "http://127.0.0.1:8080" } },
  preview: { proxy: { "/api": "http://127.0.0.1:8080" } },
}));
