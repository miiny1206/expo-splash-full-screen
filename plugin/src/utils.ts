import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import type { NormalizedProps, SplashScreenPluginProps } from './types';

const PKG = 'expo-splash-full-screen';

export function normalize(raw: SplashScreenPluginProps | undefined): NormalizedProps {
  if (!raw || !raw.image) {
    throw new Error(`[${PKG}] \`image\` prop is required.`);
  }

  const iconSplash = raw.iconSplash
    ? {
        image: raw.iconSplash.image,
        imageWidth: raw.iconSplash.imageWidth ?? 200,
        android: raw.iconSplash.android ?? true,
        ios: raw.iconSplash.ios ?? true,
      }
    : null;

  return {
    image: raw.image,
    backgroundColor: raw.backgroundColor ?? '#FFFFFF',
    resizeMode: raw.resizeMode ?? 'cover',
    fadeIn: raw.fadeIn ?? 250,
    fadeOut: raw.fadeOut ?? 300,
    iconDisplayMs: raw.iconDisplayMs ?? 1200,
    crossfadeMs: raw.crossfadeMs ?? 400,
    fullscreenHoldMs: raw.fullscreenHoldMs ?? 600,
    baseWidth: raw.baseWidth ?? 360,
    baseHeight: raw.baseHeight ?? 800,
    iconSplash,
  };
}

let cachedSips: boolean | undefined;
export function canResizeWithSips(): boolean {
  if (cachedSips !== undefined) return cachedSips;
  try {
    execFileSync('xcrun', ['--find', 'sips'], { stdio: 'ignore' });
    cachedSips = true;
  } catch {
    cachedSips = false;
  }
  return cachedSips;
}

export function writeScaled(
  source: string,
  dest: string,
  width: number,
  height: number,
  useSips: boolean,
): void {
  if (useSips) {
    execFileSync('sips', ['-z', String(height), String(width), source, '--out', dest], {
      stdio: 'ignore',
    });
  } else {
    fs.copyFileSync(source, dest);
  }
}

export function hexToRgb01(hex: string): { r: string; g: string; b: string } {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = parseInt(expanded, 16);
  return {
    r: (((n >> 16) & 255) / 255).toFixed(6),
    g: (((n >> 8) & 255) / 255).toFixed(6),
    b: ((n & 255) / 255).toFixed(6),
  };
}

export const PACKAGE_NAME = PKG;
