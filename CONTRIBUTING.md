# Contributing

## Setup

```bash
bun install
bun run build
```

`bun install` runs `prepare` which builds both the JS module (`build/`) and the config plugin (`plugin/build/`).

## Workflow

1. Create a branch from `master`.
2. Edit. When changing one side of a plugin↔native pair (Info.plist key, Android `res/values` name, drawable name, JS API shape), change the paired side in the same commit. See `AGENTS.md` for the full pair table.
3. Run the verification commands below.
4. Open a PR using the template.

## Verification

Lib-side:

```bash
bun run typecheck
bun run lint
bun run format:check
bun test
bun run build
bun pm pack
```

Consumer-side (use the reference test app or your own Expo app):

```bash
mv node_modules /tmp/nm-$(date +%s)
mv bun.lock /tmp/lock-$(date +%s)
bun install
bunx expo prebuild --clean
bunx expo-modules-autolinking resolve --platform android --json | grep splashfullscreen
```

The autolink output must include `expo.modules.splashfullscreen.SplashScreenPackage`. Empty array means autolinking is broken — usually caused by symlinked directory deps. Use a tarball install.

Inspect generated artifacts:

- `android/app/src/main/res/values/splashscreen.xml` — `splash_*` keys.
- `android/app/src/main/res/values/styles.xml` — `AppTheme` and `Theme.App.SplashScreen` `android:windowBackground = @color/splash_background`.
- `android/app/src/main/res/drawable-*/splash_*.png` — density buckets.
- `ios/<App>/Info.plist` — `Splash*` keys.
- `ios/<App>/Images.xcassets/Splash{FullScreen,Icon}.imageset/` — 1x/2x/3x.
- `ios/<App>/SplashScreen.storyboard` — backgroundColor matches plugin prop.

Then run `bunx expo run:android` / `run:ios` on your hardware.

## Commits

Conventional Commits: `type(scope): summary`.

- Scopes: `plugin`, `android`, `ios`, `js`, `docs`, `repo`.
- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `build`, `ci`, `perf`, `revert`.
- Subject: lowercase, imperative, no trailing period.
- `!` + `BREAKING CHANGE:` footer when plugin props or JS API change shape.

Releases are automated via `semantic-release` on every push to `master`.

## Lint / Format Policy

- Fix root cause first.
- `// oxlint-disable-next-line <rule> -- <reason>` is the last resort. The `-- <reason>` is mandatory.
- Do not loosen `.oxlintrc.json` for one file. If a rule is systemically wrong, open an issue.

## Animation Defaults

Keep behavior in sync across both platforms:

- `fadeIn`: ease-out (`DecelerateInterpolator` / `.curveEaseOut`).
- `crossfade`: ease-in-out (`PathInterpolator(0.77, 0, 0.175, 1)` / `.curveEaseInOut`).
- `fadeOut`: ease-in (`AccelerateInterpolator` / `.curveEaseIn`).
- Do not animate from `scale(0)` equivalents. Start from visible geometry + `alpha = 0`.
- Deferred `hide()` is a feature, not a bug — preserve the brand minimum.

## Pull Request Checklist

- [ ] `bun run typecheck && bun run lint && bun run format:check && bun test` pass.
- [ ] Pair table respected (plugin ↔ native, JS API ↔ native module).
- [ ] README / Compatibility table updated if user-facing behavior changed.
- [ ] Tested on at least one Android API level + iOS version.
- [ ] Conventional Commit subject.
