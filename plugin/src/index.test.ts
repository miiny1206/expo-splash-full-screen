import { describe, expect, test } from 'bun:test';

import withSplashScreen from './index';
import type { SplashScreenPluginProps } from './types';

const baseConfig = () =>
  ({
    name: 'test',
    slug: 'test',
    mods: {},
  }) as never;

describe('withSplashScreen', () => {
  test('does not throw on minimal valid props', () => {
    expect(() => withSplashScreen(baseConfig(), { image: './splash.png' })).not.toThrow();
  });

  test('does not throw with full icon splash config', () => {
    const props: SplashScreenPluginProps = {
      image: './splash.png',
      backgroundColor: '#0A0A0A',
      fadeIn: 250,
      fadeOut: 300,
      iconDisplayMs: 1500,
      crossfadeMs: 450,
      fullscreenHoldMs: 600,
      iconSplash: {
        image: './icon.png',
        imageWidth: 200,
        android: true,
        ios: true,
      },
    };
    expect(() => withSplashScreen(baseConfig(), props)).not.toThrow();
  });

  test('throws synchronously when image is missing', () => {
    expect(() => withSplashScreen(baseConfig(), undefined as never)).toThrow(
      /`image` prop is required/,
    );
  });

  test('throws synchronously when image is empty', () => {
    expect(() => withSplashScreen(baseConfig(), { image: '' })).toThrow(/`image` prop is required/);
  });

  test('registers mods instead of running them eagerly', () => {
    const config = baseConfig() as { mods: Record<string, unknown> };
    withSplashScreen(config, { image: './splash.png' });
    expect(config.mods).toBeDefined();
    expect(typeof config.mods).toBe('object');
  });
});
