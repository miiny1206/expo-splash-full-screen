# expo-splash-full-screen

Full-screen splash screen for Expo. Supports an optional icon layer that cross-fades into a full-bleed image. Bypasses Android 12+ `Theme.SplashScreen` icon-only enforcement with a `Dialog` overlay on Android and a `UIView` overlay on iOS.

## Features

- Full-bleed image on Android 12+ and iOS
- Optional icon layer with per-OS toggle
- Configurable fade in / cross-fade / fade out
- Zero manual native code: Expo autolinking + config plugin

## Compatibility

| Stack        | Minimum    | Verified           |
| ------------ | ---------- | ------------------ |
| Expo SDK     | 54         | 54, 55             |
| React Native | 0.80       | 0.80, 0.81         |
| React        | 19         | 19                 |
| iOS          | 15.1       | 15.1 – 18          |
| Android      | API 24 (7) | 24, 30, 33, 34, 35 |
| Node (build) | 22         | 22                 |
| Bun          | 1.x        | latest             |

### Library version → Expo SDK

| Library | Expo SDK |
| ------- | -------- |
| 1.0.x   | 54 – 55  |

### New Architecture

Compatible with bridgeless mode (RN 0.80+). Old Architecture also supported. Library does not call any RN view manager APIs — overlay mounts as a native window above the React surface.

### Known limitations

- Storyboard auto-generated for portrait. iPad landscape requires a custom storyboard.
- Foldables tested in unfolded state only. Fold/unfold transitions during splash undefined.
- tvOS declared in podspec but runtime not validated.
- Edge-to-edge enforced on Android API 35+; legacy `statusBarColor` flags applied on lower API levels for parity.

## Install

```bash
bun add expo-splash-full-screen
```

Add to `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-full-screen",
        {
          "image": "./assets/splash.png",
          "backgroundColor": "#0A0A0A",
          "fadeIn": 250,
          "fadeOut": 300,
          "iconDisplayMs": 1000,
          "crossfadeMs": 450,
          "fullscreenHoldMs": 500,
          "iconSplash": {
            "image": "./assets/icon.png",
            "imageWidth": 240,
            "android": true,
            "ios": true
          }
        }
      ]
    ]
  }
}
```

```bash
bunx expo prebuild --clean
bunx expo run:android
bunx expo run:ios
```

## Props

| Prop                    | Type          | Default     | Description                                              |
| ----------------------- | ------------- | ----------- | -------------------------------------------------------- |
| `image` **(required)**  | `string`      | —           | Full-screen splash PNG                                   |
| `backgroundColor`       | `string`      | `"#FFFFFF"` | Hex color behind the icon layer                          |
| `fadeIn`                | `number` (ms) | `250`       | Fade-in duration (ease-out)                              |
| `fadeOut`               | `number` (ms) | `300`       | Fade-out when `hide({ fade: true })` (ease-in)           |
| `iconDisplayMs`         | `number` (ms) | `1200`      | Hold between fade-in end and cross-fade start            |
| `crossfadeMs`           | `number` (ms) | `400`       | Icon → full-screen cross-fade (ease-in-out)              |
| `fullscreenHoldMs`      | `number` (ms) | `600`       | Min time full-screen visible before `hide()` can dismiss |
| `baseWidth`             | `number`      | `360`       | Logical width used for density scaling                   |
| `baseHeight`            | `number`      | `800`       | Logical height used for density scaling                  |
| `iconSplash`            | `object`      | —           | Enables the icon layer                                   |
| `iconSplash.image`      | `string`      | —           | Icon PNG                                                 |
| `iconSplash.imageWidth` | `number`      | `200`       | Icon width in dp/pt                                      |
| `iconSplash.android`    | `boolean`     | `true`      | Enable icon on Android                                   |
| `iconSplash.ios`        | `boolean`     | `true`      | Enable icon on iOS                                       |

## JS API

```ts
import SplashScreen from 'expo-splash-full-screen';

await SplashScreen.hide(); // fade out, default duration
await SplashScreen.hide({ fade: false }); // instant
await SplashScreen.hide({ fade: true, duration: 500 }); // custom duration
await SplashScreen.showFullScreen(); // force cross-fade
```

### Events

Subscribe to overlay lifecycle. Useful for analytics or timing other UI to the splash.

```ts
import SplashScreen from 'expo-splash-full-screen';

const showSub = SplashScreen.addListener('didShow', () => {
  // Overlay is now visible on screen.
});

const hideSub = SplashScreen.addListener('didHide', () => {
  // Overlay torn down. Safe to navigate, fetch, etc.
});

const failSub = SplashScreen.addListener('didFail', ({ reason }) => {
  console.warn('Splash failed to mount:', reason);
});

// Always remove when done (e.g. component unmount).
showSub.remove();
hideSub.remove();
failSub.remove();
```

| Event     | Payload             | When                                                    |
| --------- | ------------------- | ------------------------------------------------------- |
| `didShow` | none                | Overlay first painted on screen.                        |
| `didHide` | none                | Overlay teardown complete (after fade-out).             |
| `didFail` | `{ reason: string}` | Overlay failed to mount. Splash will not show this run. |

## Timing

The natural timeline from overlay mount:

```
fadeIn → hold(iconDisplayMs) → crossfade → hold(fullscreenHoldMs) → fadeOut
```

`hide()` respects this timeline. If called before the sequence completes, it **defers** the fade-out until the natural minimum elapses — your brand moment always lands. If called after, it fades out immediately.

## How it works

**Android** — `ReactActivityLifecycleListener.onCreate` mounts a transparent `Dialog` with a 2-layer `FrameLayout` (icon + full-screen `ImageView`). Theme parent is irrelevant — the Dialog is independent.

**iOS** — `ExpoAppDelegateSubscriber.didFinishLaunchingWithOptions` adds a `UIView` overlay to the key window with the same 2-layer structure. `SplashScreen.storyboard` is patched at prebuild to match `backgroundColor` + optional centered icon for seamless OS-to-overlay handoff.

## Migration from `expo-splash-screen`

This library replaces `expo-splash-screen`. Do not install both.

1. Remove `expo-splash-screen` from `package.json`.
2. Remove its config plugin block from `app.json` plugins array.
3. Add `expo-splash-full-screen` plugin block (see [Install](#install)).
4. Move calls from `import * as SplashScreen from 'expo-splash-screen'` to:
   ```ts
   import SplashScreen from 'expo-splash-full-screen';
   await SplashScreen.hide();
   ```
5. `bunx expo prebuild --clean` to regenerate native projects.

### API differences

| `expo-splash-screen`                  | `expo-splash-full-screen`                               |
| ------------------------------------- | ------------------------------------------------------- |
| `SplashScreen.preventAutoHideAsync()` | Not needed — overlay shows automatically until `hide()` |
| `SplashScreen.hideAsync()`            | `SplashScreen.hide()`                                   |
| `setOptions({ duration, fade })`      | `hide({ duration, fade })`                              |
| Icon-only on Android 12+              | Full-bleed image with optional icon layer               |

## Troubleshooting

### Splash does not show on Android 12+

Check autolinking detected the package:

```bash
bunx expo-modules-autolinking resolve --platform android --json | grep splashfullscreen
```

The output must include `"expo.modules.splashfullscreen.SplashScreenPackage"`. If empty, the package was not autolinked — usually caused by installing the lib via a symlinked directory dep (`file:../expo-splash-full-screen`). Use the published npm version or a tarball (`file:.../expo-splash-full-screen-x.y.z.tgz`).

### Black flash on iOS cold-start

The iOS storyboard background must match the plugin `backgroundColor`. The plugin patches it at prebuild — if it doesn't, run:

```bash
bunx expo prebuild --clean
```

Then verify `ios/<App>/SplashScreen.storyboard` contains a `backgroundColor` that matches your hex. If you customised the storyboard, your changes will be overwritten on the next prebuild.

### Splash hangs when Metro is down (dev)

iOS auto-dismisses on `RCTJavaScriptDidFailToLoadNotification`. Android has no equivalent — terminate the app and restart Metro before relaunch.

### Splash dismisses too quickly / too slowly

The minimum visible duration is:

```
fadeIn + iconDisplayMs + crossfadeMs + fullscreenHoldMs   (icon enabled)
fadeIn + fullscreenHoldMs                                 (icon disabled)
```

`hide()` defers the fade-out until this minimum has elapsed. To shorten the brand moment, reduce `iconDisplayMs` and `fullscreenHoldMs`. To skip deferral, set both to `0`.

### Plugin throws "image not found"

Paths in the plugin block are resolved relative to the project root (where `app.json` lives). Use `./assets/splash.png` not `assets/splash.png`.

### Image looks stretched

The plugin scales source PNGs to `baseWidth` × `baseHeight` (default 360×800) before generating density buckets. Provide a source image at or above this size — upscaling causes blur, downscaling matches the device aspect via `FIT_XY` (Android) / `scaleAspectFill` (iOS).

## Example

A runnable Expo app lives in [`example/`](./example) with the JS event API wired up to an on-screen log. From the repository root:

```bash
bun run example:bootstrap   # build + pack lib, install into example, prebuild --clean
cd example
bun run ios                 # or: bun run android
```

You'll need to drop your own splash / icon PNGs into `example/assets/` before prebuild — see [`example/README.md`](./example/README.md).

## Develop

```bash
bun install
bun run build
```

## License

MIT
