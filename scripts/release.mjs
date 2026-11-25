// Bumps every workspace package.json to one version, commits it, and tags GitHub.
// Usage: npm run release -- patch|minor|major|x.y.z [--no-push]
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifests = [
  "package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/game/package.json",
];

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const push = !args.includes("--no-push");
const bump = args.find((arg) => !arg.startsWith("--"));

if (!bump) {
  console.error("Usage: npm run release -- patch|minor|major|x.y.z [--no-push]");
  process.exit(1);
}

const git = (gitArgs, { allowFailure = false } = {}) => {
  const result = spawnSync("git", gitArgs, { cwd: root, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stderr || result.stdout || "");
    process.exit(result.status ?? 1);
  }
  return (result.stdout ?? "").trim();
};

const dirty = git(["status", "--porcelain"]);
if (dirty) {
  console.error("Working tree is not clean. Commit or stash changes before releasing.");
  process.exit(1);
}

const current = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  .version;
const next = nextVersion(current, bump);
const tag = `v${next}`;

if (git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { allowFailure: true })) {
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
}

for (const file of manifests) {
  const path = new URL(`../${file}`, import.meta.url);
  const json = JSON.parse(readFileSync(path, "utf8"));
  json.version = next;
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = json[field];
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (name.startsWith("@kart-party/")) deps[name] = next;
    }
  }
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

git(["add", ...manifests]);
git(["commit", "-m", `Release ${tag}`]);
git(["tag", "-a", tag, "-m", `Release ${tag}`]);

if (push) {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  git(["push", "origin", branch]);
  git(["push", "origin", tag]);
}

console.log(`Released ${tag}${push ? " and pushed the tag" : ""}.`);

function nextVersion(current, requested) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    console.error(`Root version "${current}" is not major.minor.patch.`);
    process.exit(1);
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (requested === "major") return `${major + 1}.0.0`;
  if (requested === "minor") return `${major}.${minor + 1}.0`;
  if (requested === "patch") return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+$/.test(requested)) return requested;
  console.error(`Unknown version "${requested}". Use patch, minor, major, or x.y.z.`);
  process.exit(1);
}
