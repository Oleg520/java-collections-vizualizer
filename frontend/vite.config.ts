import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  define: {
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
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://127.0.0.1:8080" } },
  preview: { proxy: { "/api": "http://127.0.0.1:8080" } },
});
