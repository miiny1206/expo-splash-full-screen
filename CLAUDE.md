# Claude Project Guidance

@AGENTS.md covers the base rules. This file captures Claude-specific conventions for `expo-splash-full-screen`.

## Investigate Before Coding

- Load the matching skill before proposing a fix in a native module or animation area. `expo-module` for module/plugin changes, `emil-design-eng` for timing and easing. Stale assumptions about Expo autolinking or Android 12+ SplashScreen cause silent breakage.
- Read the actual file before asserting anything about it. No speculation from memory or summary. If a memory references a path, verify the path still exists before acting on it.

## Synchronized Edits

When you edit one side, edit the pair in the same turn:

| Write side                                                   | Read side                                                                                                             |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `plugin/src/ios.ts` Info.plist keys                          | `ios/SplashScreenOverlay.swift` `currentConfig()`                                                                     |
| `plugin/src/android.ts` `<integer>`/`<bool>`/`<color>` names | `android/.../SplashScreenOverlay.kt` `getInt` / `getBool` / `getColor` lookups                                        |
| `plugin/src/android.ts` drawable filenames                   | `android/.../SplashScreenOverlay.kt` `getIdentifier(..., "drawable", ...)`                                            |
| `plugin/src/ios.ts` imageset names                           | `ios/SplashScreenOverlay.swift` `UIImage(named:)`                                                                     |
| `plugin/src/types.ts` prop shape                             | `plugin/src/utils.ts` `normalize()` defaults + README Props table                                                     |
| `src/SplashScreen.types.ts` JS API                           | `android/.../SplashScreenModule.kt` + `ios/SplashScreenModule.swift` AsyncFunction signatures + README JS API section |
| Android Java package path                                    | `expo-module.config.json` `android.modules` + `android.packages` fully-qualified names                                |
| iOS Swift module `Name("...")`                               | `src/SplashScreenModule.ts` `requireNativeModule('...')`                                                              |

## Verification Loop

After any lib edit that changes runtime behavior:

1. `cd /Users/thanglb/workspace/expo-splash-full-screen && bun run build && bun pm pack`.
2. `cd /Users/thanglb/workspace/aaf-splash-test` → `mv node_modules /tmp/aaf-nm-$(date +%s)` + `mv bun.lock /tmp/aaf-lock-$(date +%s)` → `bun install`.
3. `bunx expo prebuild --clean`.
4. `bunx expo-modules-autolinking resolve --platform android --json | grep -A3 splashfullscreen` — `packages[]` must contain `SplashScreenPackage`. Empty = autolink broken (usually symlink regression).
5. Inspect generated artifacts listed in `AGENTS.md` §Verification.
6. Stop here. Do not run `expo run:android` / `run:ios` — the user does that.

## Animation Defaults

- Entrance: ease-out custom curve. Never `ease-in` on mount — feels sluggish at the moment the user is watching hardest.
- Crossfade: ease-in-out, 400–450 ms range. Shorter feels rushed; longer drags.
- Exit: ease-in. `AccelerateInterpolator` / `.curveEaseIn` fine.
- Do not animate from `scale(0)` equivalents. Start from visible geometry + `alpha = 0`.
- Deferred `hide()` is a feature, not a bug. Do not "fix" it by firing immediately — the user's brand moment is the point of this library.

## Don't

- Don't switch the consumer dep from tarball back to `file:../expo-splash-full-screen` (directory) — breaks autolinking via symlink.
- Don't wrap the overlay in React / JS components or import the official `expo-splash-screen` — this library replaces it.
- Don't use `rm -rf` for cache wipes (denied by policy). Use `mv <target> /tmp/<name>-$(date +%s)`.
- Don't introduce Effect, XState, Jest, or a test runner unless the task explicitly asks.
- Don't amend commits, force-push, or skip hooks unless explicitly instructed.
- Don't create `*.md` planning, summary, or analysis files proactively.

## Commits

Follow `AGENTS.md` §Commits. Only commit when the user asks.
