import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// One Worker (apps/worker) serves this app's build and the room API.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ configPath: "../worker/wrangler.jsonc" }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
  },
  server: { host: true, port: 5180, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
