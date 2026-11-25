import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import { offlineWorker, offlineWorkerSource } from "./offline-worker";

describe("offline worker", () => {
  it("precaches the app shell and built files, never the room API", () => {
    const source = offlineWorkerSource("abc123", ["/", "/assets/index-1.js"]);
    expect(source).toContain('const CACHE = "kart-party-abc123"');
    expect(source).toContain('["/","/assets/index-1.js"]');
    expect(source).toContain('url.pathname.startsWith("/api")');
    // A page load tries the network first, so online visits get the latest build.
    expect(source).toContain('request.mode === "navigate"');
    // Module scripts send Origin; the server answers Vary: Origin. Hashed files ignore it.
    expect(source).toContain("ignoreVary: true");
    expect(() => new Function(source)).not.toThrow();
  });

  it("lists the client build and public files, and versions the cache by them", () => {
    // Tests run from apps/web.
    // Relative to this file, so the test passes from any working folder.
    const publicDir = resolve(import.meta.dirname, "../public");
    const plugin = offlineWorker(publicDir);
    const emitted: { fileName: string; source: string }[] = [];
    const run = (files: string[]) => {
      const hook = plugin.generateBundle as unknown as (
        this: { emitFile: (file: { fileName: string; source: string }) => void },
        options: unknown,
        bundle: Record<string, unknown>,
      ) => void;
      hook.call(
        { emitFile: vi.fn((file) => emitted.push(file)) },
        {},
        Object.fromEntries(files.map((file) => [file, {}])),
      );
      return emitted.at(-1)!;
    };
    const first = run([
      "index.html",
      "assets/index-a.js",
      "assets/app.css",
      "assets/x.js.map",
    ]);
    expect(first.fileName).toBe("sw.js");
    expect(first.source).toContain('"/assets/index-a.js"');
    expect(first.source).toContain('"/assets/app.css"');
    expect(first.source).toContain('"/manifest.webmanifest"');
    expect(first.source).toContain('"/icons/icon-512.png"');
    expect(first.source).not.toContain("x.js.map");
    expect(first.source).not.toContain('"/index.html"');
    const second = run(["index.html", "assets/index-b.js", "assets/app.css"]);
    const version = (text: string) => /kart-party-([0-9a-f]+)/.exec(text)?.[1];
    expect(version(second.source)).not.toBe(version(first.source));
  });
});
