# expo-splash-full-screen example

Minimal Expo app that demonstrates the splash overlay and the JS event API.

## Assets

Placeholder solid-color PNGs are tracked in `assets/` so the example runs out of the box:

| File                       | Size        | Color                 |
| -------------------------- | ----------- | --------------------- |
| `assets/splash.png`        | 1080 × 2400 | `#1A1A1A` (dark grey) |
| `assets/splash-icon.png`   | 512 × 512   | `#FFFFFF` (white)     |
| `assets/icon.png`          | 1024 × 1024 | `#FFFFFF` (white)     |
| `assets/adaptive-icon.png` | 1024 × 1024 | `#FFFFFF` (white)     |

The splash bg is `#0A0A0A` so the dark-grey `splash.png` and white `splash-icon.png` both stay visible against the bg, making the cross-fade easy to observe. Replace any of these with branded assets for a real demo.

To regenerate the placeholders after editing the script:

```bash
bun scripts/gen-example-assets.ts   # from repo root
```

## Run

From the **repository root**:

```bash
bun run example:bootstrap   # build + pack lib, install into example, prebuild --clean
```

Then in `example/`:

```bash
bun run ios       # iOS simulator
bun run android   # Android emulator
```

## What it does

1. App boot triggers the native splash overlay automatically.
2. On JS mount, `App.tsx` subscribes to `didShow` / `didHide` / `didFail` and renders an event log.
3. Buttons let you call `hide()`, `hide({ fade: false })`, and `showFullScreen()` manually to verify behavior.

## Updating after a lib change

Re-run `bun run example:bootstrap` from the repo root. It re-packs the lib, reinstalls the tarball, and runs `expo prebuild --clean` so the plugin re-emits resources.
