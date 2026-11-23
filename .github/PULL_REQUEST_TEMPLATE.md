## Summary

<!-- Describe what changed and why. -->

## Workspaces Touched

- [ ] `packages/game` (`@kart-party/game`)
- [ ] `apps/web` (`@kart-party/web`)
- [ ] `apps/worker` (`@kart-party/worker`)
- [ ] `docs` / repository configuration

## Verification

- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build` _(if web module graph, assets, or Vite config changed)_

## Invariant Checklist

- [ ] All race rules continue to run through `RaceSession` (no duplicate race loop)
- [ ] No `Date.now()` or browser/Worker APIs added to `packages/game`
- [ ] `three` stays confined to `apps/web/src/kart` behind `lazy()`
- [ ] No frame-by-frame React `setState` in the canvas loop
- [ ] Player-facing copy uses British English, accessible controls, and reduced-motion support
- [ ] Content is 100% original (no third-party game assets, names, or tracks)
