import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { offlineWorker } from "./build/offline-worker.ts";

// One Worker (apps/worker) serves this app's build and the room API.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ configPath: "../worker/wrangler.jsonc" }),
    offlineWorker(fileURLToPath(new URL("./public", import.meta.url))),
  ],
  build: {
    // The one large chunk is three.js with the driver rig, shared by the race and
    // the results podium. It loads only when a race or results open, never on the home page.
    chunkSizeWarningLimit: 800,
  },
  server: { host: true, port: 5180, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
