# expo-splash-full-screen

Full-screen splash screen for Expo. Supports an optional icon layer that cross-fades into a full-bleed image. Bypasses Android 12+ `Theme.SplashScreen` icon-only enforcement with a `Dialog` overlay on Android and a `UIView` overlay on iOS.

## Features

- Full-bleed image on Android 12+ and iOS
- Optional icon layer with per-OS toggle
- Configurable fade in / cross-fade / fade out
- Zero manual native code: Expo autolinking + config plugin

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
          "iconDisplayMs": 1200,
          "crossfadeMs": 400,
          "iconSplash": {
            "image": "./assets/icon.png",
            "imageWidth": 200,
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

| Prop                    | Type          | Default     | Description                                  |
| ----------------------- | ------------- | ----------- | -------------------------------------------- |
| `image` **(required)**  | `string`      | —           | Full-screen splash PNG                       |
| `backgroundColor`       | `string`      | `"#FFFFFF"` | Hex color behind the icon layer              |
| `fadeIn`                | `number` (ms) | `250`       | Fade-in duration (ease-out)                  |
| `fadeOut`               | `number` (ms) | `300`       | Fade-out when `hide({ fade: true })` (ease-in) |
| `iconDisplayMs`         | `number` (ms) | `1200`      | Hold between fade-in end and cross-fade start |
| `crossfadeMs`           | `number` (ms) | `400`       | Icon → full-screen cross-fade (ease-in-out)  |
| `fullscreenHoldMs`      | `number` (ms) | `600`       | Min time full-screen visible before `hide()` can dismiss |
| `baseWidth`             | `number`      | `360`       | Logical width used for density scaling       |
| `baseHeight`            | `number`      | `800`       | Logical height used for density scaling      |
| `iconSplash`            | `object`      | —           | Enables the icon layer                       |
| `iconSplash.image`      | `string`      | —           | Icon PNG                                     |
| `iconSplash.imageWidth` | `number`      | `200`       | Icon width in dp/pt                          |
| `iconSplash.android`    | `boolean`     | `true`      | Enable icon on Android                       |
| `iconSplash.ios`        | `boolean`     | `true`      | Enable icon on iOS                           |

## JS API

```ts
import SplashScreen from 'expo-splash-full-screen';

await SplashScreen.hide(); // fade out, default duration
await SplashScreen.hide({ fade: false }); // instant
await SplashScreen.hide({ fade: true, duration: 500 }); // custom duration
await SplashScreen.showFullScreen(); // force cross-fade
```

## Timing

The natural timeline from overlay mount:

```
fadeIn → hold(iconDisplayMs) → crossfade → hold(fullscreenHoldMs) → fadeOut
```

`hide()` respects this timeline. If called before the sequence completes, it **defers** the fade-out until the natural minimum elapses — your brand moment always lands. If called after, it fades out immediately.

## How it works

**Android** — `ReactActivityLifecycleListener.onCreate` mounts a transparent `Dialog` with a 2-layer `FrameLayout` (icon + full-screen `ImageView`). Theme parent is irrelevant — the Dialog is independent.

**iOS** — `ExpoAppDelegateSubscriber.didFinishLaunchingWithOptions` adds a `UIView` overlay to the key window with the same 2-layer structure. `SplashScreen.storyboard` is patched at prebuild to match `backgroundColor` + optional centered icon for seamless OS-to-overlay handoff.

## Develop

```bash
bun install
bun run build
```

## License

MIT
