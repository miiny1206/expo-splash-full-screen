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
  config = withAndroidAppTheme(config);
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
const WINDOW_BG_VALUE = '@color/splash_background';

const withAndroidAppTheme: ConfigPlugin = (config) =>
  withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults.resources?.style;
    if (!Array.isArray(styles)) return cfg;

    for (const name of ['AppTheme', 'Theme.App.SplashScreen']) {
      const style = styles.find((s) => s.$.name === name);
      if (!style) continue;

      if (!Array.isArray(style.item)) style.item = [];
      const existing = style.item.find((i) => i.$.name === WINDOW_BG_KEY);
      if (existing) {
        existing._ = WINDOW_BG_VALUE;
      } else {
        style.item.push({ $: { name: WINDOW_BG_KEY }, _: WINDOW_BG_VALUE });
      }
    }

    return cfg;
  });
