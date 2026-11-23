import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    pool: process.platform === "win32" ? "threads" : "forks",
    maxWorkers: process.platform === "win32" ? 1 : 2,
    execArgv:
      Number(process.versions.node.split(".")[0]) >= 25 ? ["--no-webstorage"] : [],
    css: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    sequence: { concurrent: false },
  },
});
