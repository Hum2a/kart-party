// Builds the web app against the production Worker environment, then deploys
// the generated Worker and assets. The Cloudflare Vite plugin writes the
// resolved production config into the build, so `wrangler deploy` needs no flags.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("../apps/web", import.meta.url));
const env = { ...process.env, CLOUDFLARE_ENV: "production" };
const run = (args) => {
  const result = spawnSync("npx", args, {
    cwd: web,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(["vite", "build"]);
run(["wrangler", "deploy"]);
