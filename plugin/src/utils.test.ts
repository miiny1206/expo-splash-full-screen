import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { canResizeWithSips, hexToRgb01, normalize, writeScaled } from './utils';

describe('normalize', () => {
  test('throws when raw is undefined', () => {
    expect(() => normalize(undefined)).toThrow(/`image` prop is required/);
  });

  test('throws when raw.image is missing', () => {
    expect(() => normalize({} as never)).toThrow(/`image` prop is required/);
  });

  test('throws when raw.image is empty string', () => {
    expect(() => normalize({ image: '' })).toThrow(/`image` prop is required/);
  });

  test('applies every default when only image is supplied', () => {
    expect(normalize({ image: './splash.png' })).toEqual({
      image: './splash.png',
      backgroundColor: '#FFFFFF',
      resizeMode: 'cover',
      fadeIn: 250,
      fadeOut: 300,
      iconDisplayMs: 1200,
      crossfadeMs: 400,
      fullscreenHoldMs: 600,
      baseWidth: 360,
      baseHeight: 800,
      iconSplash: null,
    });
  });

  test('preserves user overrides and leaves other fields at defaults', () => {
    const result = normalize({
      image: './splash.png',
      backgroundColor: '#0A0A0A',
      fadeIn: 500,
      iconDisplayMs: 2000,
    });
    expect(result.backgroundColor).toBe('#0A0A0A');
    expect(result.fadeIn).toBe(500);
    expect(result.iconDisplayMs).toBe(2000);
    expect(result.fadeOut).toBe(300);
    expect(result.crossfadeMs).toBe(400);
    expect(result.fullscreenHoldMs).toBe(600);
  });

  test('iconSplash is null when not provided', () => {
    expect(normalize({ image: './splash.png' }).iconSplash).toBeNull();
  });

  test('iconSplash defaults fill in when only image supplied', () => {
    expect(
      normalize({
        image: './splash.png',
        iconSplash: { image: './icon.png' } as never,
      }).iconSplash,
    ).toEqual({
      image: './icon.png',
      imageWidth: 200,
      android: true,
      ios: true,
    });
  });

  test('iconSplash per-OS toggles survive', () => {
    expect(
      normalize({
        image: './splash.png',
        iconSplash: {
          image: './icon.png',
          imageWidth: 300,
          android: false,
          ios: true,
        },
      }).iconSplash,
    ).toEqual({
      image: './icon.png',
      imageWidth: 300,
      android: false,
      ios: true,
    });
  });

  test('does not mutate input object', () => {
    const input = { image: './splash.png', fadeIn: 100 };
    const snapshot = { ...input };
    normalize(input);
    expect(input).toEqual(snapshot);
  });
});

describe('hexToRgb01', () => {
  test('#000000 maps to 0,0,0', () => {
    expect(hexToRgb01('#000000')).toEqual({
      r: '0.000000',
      g: '0.000000',
      b: '0.000000',
    });
  });

  test('#FFFFFF maps to 1,1,1', () => {
    expect(hexToRgb01('#FFFFFF')).toEqual({
      r: '1.000000',
      g: '1.000000',
      b: '1.000000',
    });
  });

  test('strips optional # prefix', () => {
    expect(hexToRgb01('000000')).toEqual(hexToRgb01('#000000'));
    expect(hexToRgb01('FFFFFF')).toEqual(hexToRgb01('#FFFFFF'));
  });

  test('expands 3-char shorthand', () => {
    expect(hexToRgb01('#ABC')).toEqual(hexToRgb01('#AABBCC'));
    expect(hexToRgb01('#F00')).toEqual(hexToRgb01('#FF0000'));
  });

  test('matches project background color #0A0A0A', () => {
    const { r, g, b } = hexToRgb01('#0A0A0A');
    expect(Number(r)).toBeCloseTo(10 / 255, 5);
    expect(Number(g)).toBeCloseTo(10 / 255, 5);
    expect(Number(b)).toBeCloseTo(10 / 255, 5);
  });

  test('preserves channel order', () => {
    const { r, g, b } = hexToRgb01('#FF8000');
    expect(Number(r)).toBeCloseTo(1, 5);
    expect(Number(g)).toBeCloseTo(128 / 255, 5);
    expect(Number(b)).toBeCloseTo(0, 5);
  });
});

describe('writeScaled', () => {
  test('copies source to destination when sips is disabled', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esfs-writeScaled-'));
    const src = path.join(dir, 'src.png');
    const dst = path.join(dir, 'dst.png');
    const payload = 'fake-png-payload';
    fs.writeFileSync(src, payload);

    writeScaled(src, dst, 100, 100, false);

    expect(fs.existsSync(dst)).toBe(true);
    expect(fs.readFileSync(dst, 'utf-8')).toBe(payload);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('does not throw when destination already exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'esfs-writeScaled-'));
    const src = path.join(dir, 'src.png');
    const dst = path.join(dir, 'dst.png');
    fs.writeFileSync(src, 'new');
    fs.writeFileSync(dst, 'old');

    expect(() => writeScaled(src, dst, 10, 10, false)).not.toThrow();
    expect(fs.readFileSync(dst, 'utf-8')).toBe('new');

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('canResizeWithSips', () => {
  test('returns a boolean without throwing', () => {
    expect(typeof canResizeWithSips()).toBe('boolean');
  });
});
