## Summary

<!-- 1–3 bullet points on what this changes and why. -->

## Type

- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] chore / build / ci

## Pair table check

When changing one side of a plugin↔native pair, the paired side must change in this PR.

- [ ] Plugin Info.plist key ↔ `SplashScreenOverlay.swift currentConfig()`
- [ ] Plugin `<integer>` / `<bool>` / `<color>` ↔ `SplashScreenOverlay.kt` getters
- [ ] Plugin drawable / imageset name ↔ native lookup
- [ ] `SplashScreen.types.ts` ↔ AsyncFunction signatures + README JS API
- [ ] N/A — change does not touch a pair

## Verification

- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run format:check`
- [ ] `bun test`
- [ ] `bun run build && bun pm pack`
- [ ] Consumer reinstall + `bunx expo prebuild --clean`
- [ ] Inspected generated artifacts (see `CONTRIBUTING.md`)
- [ ] Tested on at least one Android API level + iOS version

Devices tested: <!-- e.g. "Pixel 7 API 34, iPhone 15 Pro iOS 17.5" -->

## Breaking change?

- [ ] No
- [ ] Yes — described above with `BREAKING CHANGE:` footer in commit
