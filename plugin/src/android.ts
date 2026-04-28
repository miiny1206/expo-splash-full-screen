import { type ConfigPlugin, withAndroidStyles, withDangerousMod } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

import type { NormalizedProps } from './types';
import { PACKAGE_NAME, canResizeWithSips, writeScaled } from './utils';

const DENSITIES = [
  { folder: 'drawable-mdpi', scale: 1 },
  { folder: 'drawable-hdpi', scale: 1.5 },
  { folder: 'drawable-xhdpi', scale: 2 },
  { folder: 'drawable-xxhdpi', scale: 3 },
  { folder: 'drawable-xxxhdpi', scale: 4 },
] as const;

export const withAndroid: ConfigPlugin<NormalizedProps> = (config, props) => {
  config = withAndroidDrawables(config, props);
  config = withAndroidSplashValues(config, props);
  config = withAndroidAppTheme(config, props);
  config = withAndroidV31SplashTheme(config, props);
  return config;
};

const withAndroidDrawables: ConfigPlugin<NormalizedProps> = (config, props) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const resDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
      const appRoot = cfg.modRequest.projectRoot;
      const useSips = canResizeWithSips();

      const fullscreenSource = path.resolve(appRoot, props.image);
      if (!fs.existsSync(fullscreenSource)) {
        throw new Error(`[${PACKAGE_NAME}] Full-screen image not found: ${fullscreenSource}`);
      }

      for (const { folder, scale } of DENSITIES) {
        const destDir = path.join(resDir, folder);
        fs.mkdirSync(destDir, { recursive: true });

        writeScaled(
          fullscreenSource,
          path.join(destDir, 'splash_fullscreen.png'),
          Math.round(props.baseWidth * scale),
          Math.round(props.baseHeight * scale),
          useSips,
        );
      }

      // Paint the overlay's first-frame content into windowBackground so the cold-start window
      // phase matches what the Dialog will render. A flat @color/splash_background would flash
      // before the Dialog mounts.
      const writeWindowLayerList = (filename: string, innerItem: string): void => {
        const drawableDir = path.join(resDir, 'drawable');
        fs.mkdirSync(drawableDir, { recursive: true });
        fs.writeFileSync(
          path.join(drawableDir, filename),
          `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background"/>
${innerItem}
</layer-list>
`,
        );
      };

      if (props.iconSplash?.android) {
        const iconSource = path.resolve(appRoot, props.iconSplash.image);
        if (!fs.existsSync(iconSource)) {
          throw new Error(`[${PACKAGE_NAME}] iconSplash image not found: ${iconSource}`);
        }

        for (const { folder, scale } of DENSITIES) {
          const sizePx = Math.round(props.iconSplash.imageWidth * scale);
          writeScaled(
            iconSource,
            path.join(resDir, folder, 'splash_icon.png'),
            sizePx,
            sizePx,
            useSips,
          );
        }

        writeWindowLayerList(
          'splash_icon_window.xml',
          `    <item android:gravity="center" android:width="${props.iconSplash.imageWidth}dp" android:height="${props.iconSplash.imageWidth}dp">
        <bitmap
            android:src="@drawable/splash_icon"
            android:gravity="fill"/>
    </item>`,
        );
      } else {
        writeWindowLayerList(
          'splash_fullscreen_window.xml',
          `    <item>
        <bitmap
            android:src="@drawable/splash_fullscreen"
            android:gravity="fill"/>
    </item>`,
        );
      }

      return cfg;
    },
  ]);

const withAndroidSplashValues: ConfigPlugin<NormalizedProps> = (config, props) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const valuesDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/values');
      fs.mkdirSync(valuesDir, { recursive: true });

      const iconEnabled = !!props.iconSplash?.android;
      const iconWidth = props.iconSplash?.imageWidth ?? 200;

      const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <bool name="splash_icon_enabled">${iconEnabled}</bool>
    <integer name="splash_icon_width">${iconWidth}</integer>
    <integer name="splash_fade_in">${props.fadeIn}</integer>
    <integer name="splash_fade_out">${props.fadeOut}</integer>
    <integer name="splash_icon_display_ms">${props.iconDisplayMs}</integer>
    <integer name="splash_crossfade_ms">${props.crossfadeMs}</integer>
    <integer name="splash_fullscreen_hold_ms">${props.fullscreenHoldMs}</integer>
    <color name="splash_background">${props.backgroundColor}</color>
</resources>
`;
      fs.writeFileSync(path.join(valuesDir, 'splashscreen.xml'), xml);
      return cfg;
    },
  ]);

const WINDOW_BG_KEY = 'android:windowBackground';

const withAndroidAppTheme: ConfigPlugin<NormalizedProps> = (config, props) =>
  withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources?.style;
    if (!Array.isArray(styles)) return cfg;

    // Both branches paint the pre-overlay layer into windowBackground so frame 1 of the
    // Activity cold-start already matches what the overlay will render (see withAndroidDrawables).
    //   Icon enabled  → bg + centered icon drawable (matches overlay icon layer).
    //   Icon disabled → bg + full-bleed splash drawable (matches overlay fullscreen layer).
    // Using a flat color here would cause a visible flash before the Dialog mounts.
    const windowBgValue = props.iconSplash?.android
      ? '@drawable/splash_icon_window'
      : '@drawable/splash_fullscreen_window';

    for (const name of ['AppTheme', 'Theme.App.SplashScreen']) {
      const style = styles.find((s) => s.$.name === name);
      if (!style) continue;

      if (!Array.isArray(style.item)) style.item = [];
      const existing = style.item.find((i) => i.$.name === WINDOW_BG_KEY);
      if (existing) {
        existing._ = windowBgValue;
      } else {
        style.item.push({ $: { name: WINDOW_BG_KEY }, _: windowBgValue });
      }
    }

    return cfg;
  });

// Android 12+ enforces a system splash screen using `windowSplashScreen*` attributes from the
// launchTheme. Without an explicit `windowSplashScreenAnimatedIcon`, the OS falls back to the
// app's launcher icon clipped to a ~108dp circle — visibly smaller than our overlay's icon
// (default 200dp), producing a small-icon → big-icon size jump as the OS splash hands off to
// our overlay.
//
// Shadow `Theme.App.SplashScreen` in `values-v31/styles.xml` so on API 31+ the OS splash
// renders only the configured background color (transparent icon), and the overlay becomes the
// single source of icon truth. The values/styles.xml entry written by withAndroidAppTheme still
// applies on API 21–30. Re-asserting `windowBackground` here keeps the cold-start window
// drawable consistent across API levels.
const withAndroidV31SplashTheme: ConfigPlugin<NormalizedProps> = (config, props) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const valuesV31Dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/values-v31',
      );
      fs.mkdirSync(valuesV31Dir, { recursive: true });

      const windowBgValue = props.iconSplash?.android
        ? '@drawable/splash_icon_window'
        : '@drawable/splash_fullscreen_window';

      const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.App.SplashScreen" parent="AppTheme">
        <item name="android:windowBackground">${windowBgValue}</item>
        <item name="android:windowSplashScreenBackground">@color/splash_background</item>
        <item name="android:windowSplashScreenAnimatedIcon">@android:color/transparent</item>
    </style>
</resources>
`;
      fs.writeFileSync(path.join(valuesV31Dir, 'styles.xml'), xml);
      return cfg;
    },
  ]);
