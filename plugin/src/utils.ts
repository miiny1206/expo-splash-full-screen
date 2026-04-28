import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import type { NormalizedProps, ResizeMode, SplashScreenPluginProps } from './types';

const PKG = 'expo-splash-full-screen';
const MS_MAX = 60_000;
const ICON_WIDTH_MAX = 1000;
const DIMENSION_MAX = 4096;
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RESIZE_MODES: readonly ResizeMode[] = ['cover', 'contain'];

function assertMs(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > MS_MAX) {
    throw new Error(
      `[${PKG}] \`${name}\` must be a finite number between 0 and ${MS_MAX} (ms). Got: ${value}`,
    );
  }
}

function assertPositiveBounded(name: string, value: number, max: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > max) {
    throw new Error(`[${PKG}] \`${name}\` must be a positive number ≤ ${max}. Got: ${value}`);
  }
}

function assertHexColor(name: string, value: string): void {
  if (typeof value !== 'string' || !HEX_RE.test(value)) {
    throw new Error(
      `[${PKG}] \`${name}\` must be a hex color (#RGB, #RRGGBB, or #RRGGBBAA). Got: ${value}`,
    );
  }
}

function assertResizeMode(value: string): asserts value is ResizeMode {
  if (!RESIZE_MODES.includes(value as ResizeMode)) {
    throw new Error(
      `[${PKG}] \`resizeMode\` must be one of ${RESIZE_MODES.join(' | ')}. Got: ${value}`,
    );
  }
}

export function normalize(raw: SplashScreenPluginProps | undefined): NormalizedProps {
  if (!raw || !raw.image) {
    throw new Error(`[${PKG}] \`image\` prop is required.`);
  }

  const fadeIn = raw.fadeIn ?? 250;
  const fadeOut = raw.fadeOut ?? 300;
  const iconDisplayMs = raw.iconDisplayMs ?? 1200;
  const crossfadeMs = raw.crossfadeMs ?? 400;
  const fullscreenHoldMs = raw.fullscreenHoldMs ?? 600;
  const baseWidth = raw.baseWidth ?? 360;
  const baseHeight = raw.baseHeight ?? 800;
  const backgroundColor = raw.backgroundColor ?? '#FFFFFF';
  const resizeMode = raw.resizeMode ?? 'cover';

  assertMs('fadeIn', fadeIn);
  assertMs('fadeOut', fadeOut);
  assertMs('iconDisplayMs', iconDisplayMs);
  assertMs('crossfadeMs', crossfadeMs);
  assertMs('fullscreenHoldMs', fullscreenHoldMs);
  assertPositiveBounded('baseWidth', baseWidth, DIMENSION_MAX);
  assertPositiveBounded('baseHeight', baseHeight, DIMENSION_MAX);
  assertHexColor('backgroundColor', backgroundColor);
  assertResizeMode(resizeMode);

  let iconSplash: NormalizedProps['iconSplash'] = null;
  if (raw.iconSplash) {
    if (!raw.iconSplash.image) {
      throw new Error(`[${PKG}] \`iconSplash.image\` is required when iconSplash is provided.`);
    }
    const imageWidth = raw.iconSplash.imageWidth ?? 200;
    assertPositiveBounded('iconSplash.imageWidth', imageWidth, ICON_WIDTH_MAX);
    iconSplash = {
      image: raw.iconSplash.image,
      imageWidth,
      android: raw.iconSplash.android ?? true,
      ios: raw.iconSplash.ios ?? true,
    };
  }

  return {
    image: raw.image,
    backgroundColor,
    resizeMode,
    fadeIn,
    fadeOut,
    iconDisplayMs,
    crossfadeMs,
    fullscreenHoldMs,
    baseWidth,
    baseHeight,
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
